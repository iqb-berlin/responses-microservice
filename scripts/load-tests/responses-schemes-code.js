import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ENDPOINT = '/schemes/code';
const PROFILE = __ENV.PROFILE || 'smoke';
const PROFILE_DEFAULTS = getProfileDefaults(PROFILE);
const PAYLOAD_NAME = __ENV.PAYLOAD || PROFILE_DEFAULTS.payload;
const SCALE_FACTOR = integerEnv('SCALE_FACTOR', PROFILE_DEFAULTS.scaleFactor);
const RATE_SCALE = numberEnv('RATE_SCALE', 1);
const RESPONSE_TIMEOUT = __ENV.RESPONSE_TIMEOUT || '60s';
const PARSE_RESPONSE = (__ENV.PARSE_RESPONSE || 'true').toLowerCase() !== 'false';
const MAX_FAILURE_RATE = numberEnv('MAX_FAILURE_RATE', 0.01);
const P95_MS = integerEnv('P95_MS', 1000);
const P99_MS = integerEnv('P99_MS', 1500);
const SUMMARY_DIR = __ENV.SUMMARY_DIR || '';
const SUMMARY_BASENAME =
  __ENV.SUMMARY_BASENAME || `responses-schemes-code-${PROFILE}-${PAYLOAD_NAME}-x${SCALE_FACTOR}`;
const SUMMARY_JSON = __ENV.SUMMARY_JSON || buildSummaryPath('json');
const SUMMARY_MD = __ENV.SUMMARY_MD || buildSummaryPath('md');
const SUMMARY_STDOUT = (__ENV.SUMMARY_STDOUT || 'true').toLowerCase() !== 'false';

const httpOk = new Rate('schemes_code_http_ok');
const jsonOk = new Rate('schemes_code_json_ok');
const arrayBodyOk = new Rate('schemes_code_body_array_ok');
const requestBytes = new Trend('schemes_code_request_bytes');
const responseBytes = new Trend('schemes_code_response_bytes');
const responseItems = new Trend('schemes_code_response_items');

const BASE_PAYLOADS = {
  small: JSON.parse(open(import.meta.resolve('./payloads/schemes-code-small.json'))),
  medium: JSON.parse(open(import.meta.resolve('./payloads/schemes-code-medium.json'))),
  complex: JSON.parse(open(import.meta.resolve('./payloads/schemes-code-complex.json')))
};

if (!BASE_PAYLOADS[PAYLOAD_NAME]) {
  throw new Error(
    `Unknown PAYLOAD "${PAYLOAD_NAME}". Use one of: ${Object.keys(BASE_PAYLOADS).join(', ')}`
  );
}

const SELECTED_PAYLOAD = buildScaledPayload(BASE_PAYLOADS[PAYLOAD_NAME], SCALE_FACTOR);
const REQUEST_BODY = JSON.stringify(SELECTED_PAYLOAD);
const REQUEST_TAGS = {
  endpoint: 'schemes_code',
  payload: PAYLOAD_NAME,
  profile: PROFILE,
  scale_factor: String(SCALE_FACTOR)
};
const REQUEST_PARAMS = {
  headers: {
    'Content-Type': 'application/json'
  },
  tags: REQUEST_TAGS,
  timeout: RESPONSE_TIMEOUT
};
const REQUEST_URL = `${trimTrailingSlash(BASE_URL)}${ENDPOINT}`;
const MIN_OK_RATE = Math.max(0, 1 - MAX_FAILURE_RATE).toFixed(4);
const SCENARIO = buildScenario(PROFILE);

export const options = {
  scenarios: {
    [`schemes_code_${PROFILE}`]: SCENARIO
  },
  thresholds: {
    http_req_failed: [`rate<${MAX_FAILURE_RATE}`],
    http_req_duration: [`p(95)<${P95_MS}`, `p(99)<${P99_MS}`],
    schemes_code_http_ok: [`rate>${MIN_OK_RATE}`],
    schemes_code_json_ok: [`rate>${MIN_OK_RATE}`],
    schemes_code_body_array_ok: [`rate>${MIN_OK_RATE}`]
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)']
};

export function runSchemeCode() {
  requestBytes.add(REQUEST_BODY.length, REQUEST_TAGS);

  const response = http.post(REQUEST_URL, REQUEST_BODY, REQUEST_PARAMS);
  const statusOk = response.status === 200;

  httpOk.add(statusOk, REQUEST_TAGS);
  responseBytes.add(response.body ? response.body.length : 0, REQUEST_TAGS);

  let parsedBody = null;
  let parseOk = true;
  let bodyIsArray = true;

  if (PARSE_RESPONSE) {
    try {
      parsedBody = response.json();
      bodyIsArray = Array.isArray(parsedBody);
      if (bodyIsArray) {
        responseItems.add(parsedBody.length, REQUEST_TAGS);
      }
    } catch (error) {
      parseOk = false;
      bodyIsArray = false;
    }
  }

  jsonOk.add(PARSE_RESPONSE ? parseOk : true, REQUEST_TAGS);
  arrayBodyOk.add(PARSE_RESPONSE ? bodyIsArray : true, REQUEST_TAGS);

  check(response, {
    'POST /schemes/code returned 200': r => r.status === 200
  });

  if (PARSE_RESPONSE) {
    check(parsedBody, {
      'response body is a JSON array': body => Array.isArray(body)
    });
  }
}

export default runSchemeCode;

export function handleSummary(data) {
  const outputs = {};
  const exportedSummary = buildExportSummary(data);
  const markdownSummary = buildMarkdownSummary(exportedSummary);

  if (SUMMARY_STDOUT) {
    outputs.stdout = `${markdownSummary}\n`;
  }

  if (SUMMARY_JSON) {
    outputs[SUMMARY_JSON] = JSON.stringify(exportedSummary, null, 2);
  }

  if (SUMMARY_MD) {
    outputs[SUMMARY_MD] = `${markdownSummary}\n`;
  }

  return outputs;
}

function buildScenario(profile) {
  switch (profile) {
    case 'smoke':
      return {
        exec: 'runSchemeCode',
        executor: 'constant-arrival-rate',
        rate: integerEnv('RATE', scaledRate(1)),
        timeUnit: '1s',
        preAllocatedVUs: integerEnv('PRE_ALLOCATED_VUS', 1),
        maxVUs: integerEnv('MAX_VUS', 5),
        duration: __ENV.DURATION || '30s',
        gracefulStop: '5s',
        tags: REQUEST_TAGS
      };
    case 'baseline':
      return {
        exec: 'runSchemeCode',
        executor: 'ramping-arrival-rate',
        startRate: scaledRate(1),
        timeUnit: '1s',
        preAllocatedVUs: integerEnv('PRE_ALLOCATED_VUS', 10),
        maxVUs: integerEnv('MAX_VUS', 40),
        stages: [
          { target: scaledRate(2), duration: '1m' },
          { target: scaledRate(5), duration: '2m' },
          { target: scaledRate(8), duration: '2m' }
        ],
        gracefulStop: '15s',
        tags: REQUEST_TAGS
      };
    case 'spike':
      return {
        exec: 'runSchemeCode',
        executor: 'ramping-arrival-rate',
        startRate: scaledRate(1),
        timeUnit: '1s',
        preAllocatedVUs: integerEnv('PRE_ALLOCATED_VUS', 15),
        maxVUs: integerEnv('MAX_VUS', 60),
        stages: [
          { target: scaledRate(3), duration: '30s' },
          { target: scaledRate(15), duration: '20s' },
          { target: scaledRate(15), duration: '40s' },
          { target: scaledRate(3), duration: '30s' }
        ],
        gracefulStop: '15s',
        tags: REQUEST_TAGS
      };
    case 'soak':
      return {
        exec: 'runSchemeCode',
        executor: 'constant-arrival-rate',
        rate: integerEnv('RATE', scaledRate(4)),
        timeUnit: '1s',
        duration: __ENV.DURATION || '30m',
        preAllocatedVUs: integerEnv('PRE_ALLOCATED_VUS', 20),
        maxVUs: integerEnv('MAX_VUS', 50),
        gracefulStop: '30s',
        tags: REQUEST_TAGS
      };
    case 'payload_scaling':
      return {
        exec: 'runSchemeCode',
        executor: 'constant-arrival-rate',
        rate: integerEnv('RATE', scaledRate(2)),
        timeUnit: '1s',
        duration: __ENV.DURATION || '10m',
        preAllocatedVUs: integerEnv('PRE_ALLOCATED_VUS', 10),
        maxVUs: integerEnv('MAX_VUS', 40),
        gracefulStop: '20s',
        tags: REQUEST_TAGS
      };
    case 'saturation_medium':
    case 'saturation_complex':
    case 'saturation_complex_x5':
    case 'saturation_complex_x10':
      return buildSaturationScenario(profile);
    default:
      throw new Error(
        `Unknown PROFILE "${profile}". Use one of: smoke, baseline, spike, soak, payload_scaling, saturation_medium, saturation_complex, saturation_complex_x5, saturation_complex_x10`
      );
  }
}

function buildSaturationScenario(profile) {
  const config = getSaturationConfig(profile);
  const rampDuration = __ENV.SATURATION_RAMP_DURATION || config.rampDuration;
  const holdDuration = __ENV.SATURATION_HOLD_DURATION || config.holdDuration;
  const targets = integerListEnv('SATURATION_TARGETS', config.targets);

  return {
    exec: 'runSchemeCode',
    executor: 'ramping-arrival-rate',
    startRate: integerEnv('SATURATION_START_RATE', scaledRate(config.startRate)),
    timeUnit: '1s',
    preAllocatedVUs: integerEnv('PRE_ALLOCATED_VUS', config.preAllocatedVUs),
    maxVUs: integerEnv('MAX_VUS', config.maxVUs),
    stages: buildSteppedStages(targets, rampDuration, holdDuration),
    gracefulStop: '30s',
    tags: {
      ...REQUEST_TAGS,
      test_kind: 'saturation'
    }
  };
}

function buildSteppedStages(targets, rampDuration, holdDuration) {
  if (targets.length === 0) {
    throw new Error('SATURATION_TARGETS must contain at least one arrival-rate target.');
  }

  return targets.flatMap(target => {
    const scaledTarget = scaledRate(target);

    return [
      { target: scaledTarget, duration: rampDuration },
      { target: scaledTarget, duration: holdDuration }
    ];
  });
}

function getProfileDefaults(profile) {
  switch (profile) {
    case 'saturation_medium':
      return { payload: 'medium', scaleFactor: 1 };
    case 'saturation_complex':
      return { payload: 'complex', scaleFactor: 1 };
    case 'saturation_complex_x5':
      return { payload: 'complex', scaleFactor: 5 };
    case 'saturation_complex_x10':
      return { payload: 'complex', scaleFactor: 10 };
    default:
      return { payload: 'small', scaleFactor: 1 };
  }
}

function getSaturationConfig(profile) {
  switch (profile) {
    case 'saturation_medium':
      return {
        startRate: 1,
        targets: [4, 8, 12, 16, 20, 24, 30],
        rampDuration: '30s',
        holdDuration: '3m30s',
        preAllocatedVUs: 20,
        maxVUs: 120
      };
    case 'saturation_complex':
      return {
        startRate: 1,
        targets: [4, 8, 12, 16, 20],
        rampDuration: '30s',
        holdDuration: '3m30s',
        preAllocatedVUs: 20,
        maxVUs: 120
      };
    case 'saturation_complex_x5':
      return {
        startRate: 1,
        targets: [2, 4, 6, 8],
        rampDuration: '30s',
        holdDuration: '3m30s',
        preAllocatedVUs: 20,
        maxVUs: 100
      };
    case 'saturation_complex_x10':
      return {
        startRate: 1,
        targets: [2, 3, 4, 5, 6],
        rampDuration: '30s',
        holdDuration: '3m30s',
        preAllocatedVUs: 20,
        maxVUs: 100
      };
    default:
      throw new Error(`Unknown saturation PROFILE "${profile}".`);
  }
}

function buildScaledPayload(payload, scaleFactor) {
  if (scaleFactor <= 1) {
    return clone(payload);
  }

  const scaledPayload = {
    unitResponses: [],
    variableCodings: []
  };

  for (let index = 1; index <= scaleFactor; index += 1) {
    const suffix = `__${leftPad(index, 3)}`;
    const idMap = buildIdMap(payload.variableCodings, suffix);

    payload.variableCodings.forEach(variableCoding => {
      const clonedVariableCoding = clone(variableCoding);

      clonedVariableCoding.id = renameValue(variableCoding.id, idMap, suffix);

      if (variableCoding.alias) {
        clonedVariableCoding.alias = renameValue(variableCoding.alias, idMap, suffix);
      }

      if (Array.isArray(variableCoding.deriveSources)) {
        clonedVariableCoding.deriveSources = variableCoding.deriveSources.map(source =>
          renameValue(source, idMap, suffix)
        );
      }

      scaledPayload.variableCodings.push(clonedVariableCoding);
    });

    payload.unitResponses.forEach(unitResponse => {
      const clonedUnitResponse = clone(unitResponse);

      clonedUnitResponse.id = renameValue(unitResponse.id, idMap, suffix);

      if (typeof unitResponse.subform !== 'undefined') {
        clonedUnitResponse.subform = `${unitResponse.subform}${suffix}`;
      }

      scaledPayload.unitResponses.push(clonedUnitResponse);
    });
  }

  return scaledPayload;
}

function buildIdMap(variableCodings, suffix) {
  const idMap = {};

  variableCodings.forEach(variableCoding => {
    idMap[variableCoding.id] = `${variableCoding.id}${suffix}`;

    if (variableCoding.alias) {
      idMap[variableCoding.alias] = `${variableCoding.alias}${suffix}`;
    }
  });

  return idMap;
}

function renameValue(value, idMap, suffix) {
  if (typeof value !== 'string') {
    return value;
  }

  return idMap[value] || `${value}${suffix}`;
}

function scaledRate(value) {
  return Math.max(1, Math.round(value * RATE_SCALE));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSummaryPath(extension) {
  if (!SUMMARY_DIR) {
    return '';
  }

  return `${trimTrailingSlash(SUMMARY_DIR)}/${SUMMARY_BASENAME}.${extension}`;
}

function buildExportSummary(data) {
  const thresholdResults = collectThresholdResults(data.metrics || {});
  const failingThresholds = thresholdResults.filter(result => result.ok === false);

  return {
    generatedAt: new Date().toISOString(),
    test: {
      baseUrl: BASE_URL,
      endpoint: ENDPOINT,
      requestUrl: REQUEST_URL,
      profile: PROFILE,
      payload: PAYLOAD_NAME,
      scaleFactor: SCALE_FACTOR,
      parseResponse: PARSE_RESPONSE,
      responseTimeout: RESPONSE_TIMEOUT
    },
    scenario: summarizeScenario(SCENARIO),
    payload: {
      requestBodyBytes: REQUEST_BODY.length,
      unitResponses: SELECTED_PAYLOAD.unitResponses.length,
      variableCodings: SELECTED_PAYLOAD.variableCodings.length
    },
    outcome: {
      thresholdFailures: failingThresholds.length,
      thresholdsPassed: failingThresholds.length === 0,
      checksRate: metricValue(data.metrics, 'checks', 'rate'),
      httpFailureRate: metricValue(data.metrics, 'http_req_failed', 'rate')
    },
    metrics: {
      iterations: metricValues(data.metrics, 'iterations'),
      httpReqs: metricValues(data.metrics, 'http_reqs'),
      httpReqDuration: metricValues(data.metrics, 'http_req_duration'),
      httpReqFailed: metricValues(data.metrics, 'http_req_failed'),
      checks: metricValues(data.metrics, 'checks'),
      schemesCodeHttpOk: metricValues(data.metrics, 'schemes_code_http_ok'),
      schemesCodeJsonOk: metricValues(data.metrics, 'schemes_code_json_ok'),
      schemesCodeBodyArrayOk: metricValues(data.metrics, 'schemes_code_body_array_ok'),
      requestBytes: metricValues(data.metrics, 'schemes_code_request_bytes'),
      responseBytes: metricValues(data.metrics, 'schemes_code_response_bytes'),
      responseItems: metricValues(data.metrics, 'schemes_code_response_items'),
      dataSent: metricValues(data.metrics, 'data_sent'),
      dataReceived: metricValues(data.metrics, 'data_received'),
      vus: metricValues(data.metrics, 'vus'),
      vusMax: metricValues(data.metrics, 'vus_max')
    },
    thresholds: thresholdResults
  };
}

function buildMarkdownSummary(summary) {
  const duration = summary.metrics.httpReqDuration || {};
  const httpFailures = summary.metrics.httpReqFailed || {};
  const checksRate = summary.metrics.checks || {};
  const thresholdsOk = summary.outcome.thresholdsPassed ? 'PASS' : 'FAIL';
  const lines = [
    '# k6 Summary: POST /schemes/code',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Base URL | ${summary.test.baseUrl} |`,
    `| Profile | ${summary.test.profile} |`,
    `| Payload | ${summary.test.payload} |`,
    `| Scale factor | ${summary.test.scaleFactor} |`,
    `| Executor | ${summary.scenario.executor || 'n/a'} |`,
    `| Request bytes | ${summary.payload.requestBodyBytes} |`,
    `| Unit responses | ${summary.payload.unitResponses} |`,
    `| Variable codings | ${summary.payload.variableCodings} |`,
    `| Threshold result | ${thresholdsOk} |`,
    `| Threshold failures | ${summary.outcome.thresholdFailures} |`,
    `| HTTP failure rate | ${formatMetricNumber(httpFailures.rate)} |`,
    `| Checks rate | ${formatMetricNumber(checksRate.rate)} |`,
    `| p95 duration (ms) | ${formatMetricNumber(duration['p(95)'])} |`,
    `| p99 duration (ms) | ${formatMetricNumber(duration['p(99)'])} |`,
    `| Avg duration (ms) | ${formatMetricNumber(duration.avg)} |`,
    ''
  ];

  if (Array.isArray(summary.scenario.stages) && summary.scenario.stages.length > 0) {
    lines.splice(9, 0, `| Stage count | ${summary.scenario.stages.length} |`);
  }

  if (summary.thresholds.length > 0) {
    lines.push('| Threshold | Metric | OK |');
    lines.push('| --- | --- | --- |');

    summary.thresholds.forEach(result => {
      lines.push(`| \`${result.threshold}\` | \`${result.metric}\` | ${result.ok ? 'yes' : 'no'} |`);
    });

    lines.push('');
  }

  return lines.join('\n');
}

function collectThresholdResults(metrics) {
  const results = [];

  Object.keys(metrics)
    .sort()
    .forEach(metricName => {
      const thresholds = metrics[metricName].thresholds || {};

      Object.keys(thresholds)
        .sort()
        .forEach(thresholdName => {
          const threshold = thresholds[thresholdName] || {};

          results.push({
            metric: metricName,
            threshold: thresholdName,
            ok: threshold.ok !== false
          });
        });
    });

  return results;
}

function summarizeScenario(scenario) {
  const summary = {
    executor: scenario.executor
  };

  [
    'startRate',
    'rate',
    'timeUnit',
    'vus',
    'duration',
    'preAllocatedVUs',
    'maxVUs',
    'gracefulStop'
  ].forEach(key => {
    if (typeof scenario[key] !== 'undefined') {
      summary[key] = scenario[key];
    }
  });

  if (Array.isArray(scenario.stages)) {
    summary.stages = scenario.stages.map(stage => ({
      target: stage.target,
      duration: stage.duration
    }));
  }

  return summary;
}

function metricValues(metrics, metricName) {
  if (!metrics || !metrics[metricName] || !metrics[metricName].values) {
    return null;
  }

  return metrics[metricName].values;
}

function metricValue(metrics, metricName, valueName) {
  const values = metricValues(metrics, metricName);

  if (!values) {
    return null;
  }

  return typeof values[valueName] === 'undefined' ? null : values[valueName];
}

function formatMetricNumber(value) {
  if (value === null || typeof value === 'undefined') {
    return 'n/a';
  }

  if (typeof value !== 'number') {
    return String(value);
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function integerEnv(name, fallback) {
  const rawValue = __ENV[name];

  if (typeof rawValue === 'undefined' || rawValue === '') {
    return fallback;
  }

  const parsedValue = parseInt(rawValue, 10);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Environment variable ${name} must be an integer.`);
  }

  return parsedValue;
}

function numberEnv(name, fallback) {
  const rawValue = __ENV[name];

  if (typeof rawValue === 'undefined' || rawValue === '') {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Environment variable ${name} must be a number.`);
  }

  return parsedValue;
}

function integerListEnv(name, fallback) {
  const rawValue = __ENV[name];

  if (typeof rawValue === 'undefined' || rawValue === '') {
    return fallback.slice();
  }

  return rawValue.split(',').map(entry => {
    const trimmedEntry = entry.trim();

    if (trimmedEntry === '') {
      throw new Error(`Environment variable ${name} must not contain empty entries.`);
    }

    const parsedValue = parseInt(trimmedEntry, 10);

    if (Number.isNaN(parsedValue)) {
      throw new Error(`Environment variable ${name} must be a comma-separated list of integers.`);
    }

    return parsedValue;
  });
}

function leftPad(value, width) {
  const stringValue = String(value);

  if (stringValue.length >= width) {
    return stringValue;
  }

  return `${'0'.repeat(width - stringValue.length)}${stringValue}`;
}

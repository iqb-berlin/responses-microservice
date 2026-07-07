import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createApp } from '../src/app';

describe('responses-microservice routes', () => {
  const app = createApp();
  const response = { id: 'v1', value: 'hello', status: 'VALUE_CHANGED' };
  const coding = {
    id: 'v1',
    sourceType: 'BASE',
    codes: [
      {
        id: 1,
        type: 'FULL_CREDIT',
        score: 1,
        ruleSets: [
          {
            rules: [
              { method: 'MATCH', parameters: ['hello'] }
            ]
          }
        ]
      }
    ]
  };
  const baseVariables = [
    {
      id: 'v1',
      type: 'string',
      format: '',
      multiple: false,
      nullable: false,
      values: [],
      valuePositionLabels: []
    }
  ];

  test('reports health', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('lists available endpoints', async () => {
    const response = await request(app).get('/').expect(200);

    expect(response.body.name).toBe('responses-microservice');
    expect(response.body.endpoints).toEqual(expect.arrayContaining([
      '/health',
      '/version',
      '/codings/code',
      '/schemes/code',
      '/schemes/validate',
      '/schemes/derive-value',
      '/text/code',
      '/text/source',
      '/text/processing',
      '/text/var-info'
    ]));
  });

  test('reports service and library versions', async () => {
    const response = await request(app).get('/version').expect(200);

    expect(response.body.service).toBe('0.1.0');
    expect(response.body.responses).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('codes a single response through @iqb/responses', async () => {
    const result = await request(app)
      .post('/codings/code')
      .send({ response, coding })
      .expect(200);

    expect(result.body).toMatchObject({
      id: 'v1',
      value: 'hello',
      status: 'CODING_COMPLETE',
      code: 1,
      score: 1
    });
  });

  test('codes responses with a coding scheme', async () => {
    const result = await request(app)
      .post('/schemes/code')
      .send({ unitResponses: [response], variableCodings: [coding] })
      .expect(200);

    expect(result.body).toEqual([
      {
        id: 'v1',
        value: 'hello',
        status: 'CODING_COMPLETE',
        code: 1,
        score: 1
      }
    ]);
  });

  test('validates a simple coding scheme', async () => {
    const result = await request(app)
      .post('/schemes/validate')
      .send({ baseVariables, variableCodings: [coding] })
      .expect(200);

    expect(result.body).toEqual([]);
  });

  test('derives a value from source responses', async () => {
    const copyCoding = {
      id: 'copy',
      sourceType: 'COPY_VALUE',
      deriveSources: ['v1'],
      codes: []
    };

    const result = await request(app)
      .post('/schemes/derive-value')
      .send({
        variableCodings: [coding, copyCoding],
        coding: copyCoding,
        sourceResponses: [response]
      })
      .expect(200);

    expect(result.body).toEqual({
      id: 'copy',
      value: 'hello',
      status: 'VALUE_CHANGED'
    });
  });

  test('renders coding, source, processing, and variable information as text', async () => {
    const codeText = await request(app)
      .post('/text/code')
      .send({ code: coding.codes[0] })
      .expect(200);
    expect(codeText.body).toMatchObject({
      id: '1',
      score: 1,
      hasManualInstruction: false
    });
    expect(codeText.body.ruleSetDescriptions[0]).toContain('hello');

    const sourceText = await request(app)
      .post('/text/source')
      .send({ variableId: 'copy', sourceType: 'COPY_VALUE', sources: ['v1'] })
      .expect(200);
    expect(sourceText.body).toEqual({ text: "Kopie von Variable 'v1'" });

    const processingText = await request(app)
      .post('/text/processing')
      .send({ processing: ['IGNORE_CASE'], fragmenting: '([A-Z]+)' })
      .expect(200);
    expect(processingText.body.text).toContain('ignoriert');
    expect(processingText.body.text).toContain('Fragmentierung');

    const varInfoText = await request(app)
      .post('/text/var-info')
      .send({ varInfo: baseVariables[0] })
      .expect(200);
    expect(varInfoText.body).toEqual(['Datentyp: String/Text']);
  });

  test('returns 400 for missing required fields', async () => {
    const result = await request(app)
      .post('/codings/code')
      .send({ response: { id: 'v1' } })
      .expect(400);

    expect(result.body).toEqual({
      error: 'Missing required request fields',
      fields: ['coding']
    });
  });

  test('returns 400 for null required fields', async () => {
    const result = await request(app)
      .post('/codings/code')
      .send({
        response: null,
        coding: { id: 'v1', sourceType: 'BASE', codes: [] }
      })
      .expect(400);

    expect(result.body).toEqual({
      error: 'Missing required request fields',
      fields: ['response']
    });
  });

  test.each([
    ['/schemes/code', { unitResponses: [] }, ['variableCodings']],
    ['/schemes/validate', { baseVariables: [] }, ['variableCodings']],
    ['/schemes/derive-value', { variableCodings: [], coding: {} }, ['sourceResponses']],
    ['/text/code', {}, ['code']],
    ['/text/source', { variableId: 'v1' }, ['sourceType']],
    ['/text/var-info', {}, ['varInfo']]
  ])('returns 400 for missing required fields on %s', async (path, body, fields) => {
    const result = await request(app)
      .post(path)
      .send(body)
      .expect(400);

    expect(result.body).toEqual({
      error: 'Missing required request fields',
      fields
    });
  });

  test('returns JSON for malformed JSON request bodies', async () => {
    const result = await request(app)
      .post('/codings/code')
      .set('Content-Type', 'application/json')
      .send('{bad json')
      .expect(400);

    expect(result.headers['content-type']).toContain('application/json');
    expect(result.body).toEqual({ error: 'Malformed JSON request body' });
  });

  test('returns JSON for unknown routes', async () => {
    const result = await request(app).get('/does-not-exist').expect(404);

    expect(result.body).toEqual({ error: 'Not found' });
  });
});

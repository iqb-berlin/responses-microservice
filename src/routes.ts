import { Router, type Request, type Response } from 'express';
import { CodingFactory, CodingSchemeFactory, ToTextFactory } from '@iqb/responses';
import { getVersionInfo } from './version';

type Body = Record<string, unknown>;

const isBody = (value: unknown): value is Body => (
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value)
);

const bodyOf = (req: Request): Body => (isBody(req.body) ? req.body : {});

const missingFields = (body: Body, fields: string[]): string[] => (
  fields.filter(field => body[field] === undefined || body[field] === null)
);

const sendMissingFields = (res: Response, fields: string[]): void => {
  res.status(400).json({
    error: 'Missing required request fields',
    fields
  });
};

const handleError = (res: Response, error: unknown): void => {
  res.status(500).json({
    error: error instanceof Error ? error.message : 'Unknown error'
  });
};

export const createRouter = (): Router => {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      name: 'responses-microservice',
      endpoints: [
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
      ]
    });
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/version', (_req, res) => {
    res.json(getVersionInfo());
  });

  router.post('/codings/code', (req, res) => {
    try {
      const body = bodyOf(req);
      const missing = missingFields(body, ['response', 'coding']);
      if (missing.length > 0) {
        sendMissingFields(res, missing);
        return;
      }

      res.json(CodingFactory.code(body.response as never, body.coding as never));
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/schemes/code', (req, res) => {
    try {
      const body = bodyOf(req);
      const missing = missingFields(body, ['unitResponses', 'variableCodings']);
      if (missing.length > 0) {
        sendMissingFields(res, missing);
        return;
      }

      res.json(CodingSchemeFactory.code(body.unitResponses as never, body.variableCodings as never));
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/schemes/validate', (req, res) => {
    try {
      const body = bodyOf(req);
      const missing = missingFields(body, ['baseVariables', 'variableCodings']);
      if (missing.length > 0) {
        sendMissingFields(res, missing);
        return;
      }

      res.json(CodingSchemeFactory.validate(body.baseVariables as never, body.variableCodings as never));
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/schemes/derive-value', (req, res) => {
    try {
      const body = bodyOf(req);
      const missing = missingFields(body, ['variableCodings', 'coding', 'sourceResponses']);
      if (missing.length > 0) {
        sendMissingFields(res, missing);
        return;
      }

      res.json(CodingSchemeFactory.deriveValue(
        body.variableCodings as never,
        body.coding as never,
        body.sourceResponses as never
      ));
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/text/code', (req, res) => {
    try {
      const body = bodyOf(req);
      const missing = missingFields(body, ['code']);
      if (missing.length > 0) {
        sendMissingFields(res, missing);
        return;
      }

      res.json(ToTextFactory.codeAsText(body.code as never, (body.mode ?? 'EXTENDED') as never));
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/text/source', (req, res) => {
    try {
      const body = bodyOf(req);
      const missing = missingFields(body, ['variableId', 'sourceType']);
      if (missing.length > 0) {
        sendMissingFields(res, missing);
        return;
      }

      const text = ToTextFactory.sourceAsText(
        body.variableId as never,
        body.sourceType as never,
        (body.sources ?? []) as never,
        body.parameters as never
      );
      res.json({ text });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/text/processing', (req, res) => {
    try {
      const body = bodyOf(req);
      const text = ToTextFactory.processingAsText(
        (body.processing ?? []) as never,
        body.fragmenting as never
      );
      res.json({ text });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/text/var-info', (req, res) => {
    try {
      const body = bodyOf(req);
      const missing = missingFields(body, ['varInfo']);
      if (missing.length > 0) {
        sendMissingFields(res, missing);
        return;
      }

      res.json(ToTextFactory.varInfoAsText(body.varInfo as never));
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
};

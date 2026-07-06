import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createApp } from '../src/app';

describe('responses-microservice routes', () => {
  const app = createApp();

  test('reports health', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('reports service and library versions', async () => {
    const response = await request(app).get('/version').expect(200);
    expect(response.body.service).toBe('0.1.0');
    expect(response.body.responses).toBe('5.2.0');
  });

  test('codes a single response through @iqb/responses', async () => {
    const response = await request(app)
      .post('/codings/code')
      .send({
        response: { id: 'v1', value: 'hello', status: 'VALUE_CHANGED' },
        coding: { id: 'v1', sourceType: 'BASE', codes: [] }
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'v1',
      value: 'hello',
      status: 'NO_CODING'
    });
  });

  test('returns 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/codings/code')
      .send({ response: { id: 'v1' } })
      .expect(400);

    expect(response.body).toEqual({
      error: 'Missing required request fields',
      fields: ['coding']
    });
  });
});

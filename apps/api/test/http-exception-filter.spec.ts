import { ArgumentsHost, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common'
import { API_ERROR_CODES } from '@rwa-lat/contracts'
import { HttpExceptionFilter } from '../src/common/http-exception.filter'

describe('HTTP exception envelope', () => {
  it('normalizes nested domain errors and only exposes public remediation fields', () => {
    const json = jest.fn()
    const host = { switchToHttp: () => ({ getRequest: () => ({ url: '/v1/test' }), getResponse: () => ({ locals: {}, status: () => ({ json }) }) }) } as unknown as ArgumentsHost
    new HttpExceptionFilter().catch(new ForbiddenException({ error: { code: 'INVESTMENT_NOT_ELIGIBLE', message: 'Blocked', reasonCodes: ['kyc_required'], decision: 'ineligible', secret: 'private' } }), host)
    expect(json.mock.calls[0][0].error).toEqual({ code: 'INVESTMENT_NOT_ELIGIBLE', message: 'Blocked', details: { reasonCodes: ['kyc_required'], decision: 'ineligible' } })
    new HttpExceptionFilter().catch(new ConflictException({ code: 'AUTH_CONSENT_VERSION_MISMATCH', message: 'Review again', requiredConsents: [{ documentType: 'terms', version: '2' }], secret: 'private' }), host)
    expect(json.mock.calls[1][0].error.details).toEqual({ requiredConsents: [{ documentType: 'terms', version: '2' }] })
  })
  it('preserves a stable domain error code', () => {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/v1/health/ready' }),
        getResponse: () => ({ locals: { requestId: 'request-123' }, status }),
      }),
    } as unknown as ArgumentsHost

    new HttpExceptionFilter().catch(
      new ServiceUnavailableException({
        code: API_ERROR_CODES.DATABASE_UNAVAILABLE,
        message: 'The database is not ready.',
      }),
      host,
    )

    expect(status).toHaveBeenCalledWith(503)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: API_ERROR_CODES.DATABASE_UNAVAILABLE,
          message: 'The database is not ready.',
        },
        requestId: 'request-123',
        path: '/v1/health/ready',
      }),
    )
  })
})

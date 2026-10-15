import { inspectPredictionResolution } from '../../src/prediction/prediction-resolution'

const local = {
  gammaMarketId: '123', conditionId: 'condition-123',
  tokens: [
    { tokenId: 'yes', outcome: 'Yes', outcomeIndex: 0 },
    { tokenId: 'no', outcome: 'No', outcomeIndex: 1 },
  ],
}
const final = {
  id: '123', conditionId: 'condition-123', closed: true, umaResolutionStatus: 'resolved',
  outcomes: '["Yes","No"]', clobTokenIds: '["yes","no"]', outcomePrices: '["1","0"]',
}

describe('final prediction resolution evidence', () => {
  it.each([
    ['["1","0"]', 'yes'], ['["0","1"]', 'no'], ['["1.000","0.00"]', 'yes'],
  ])('maps the exact final payout vector %s to its token', (prices, winnerTokenId) => {
    expect(inspectPredictionResolution({ ...final, outcomePrices: prices }, local)).toEqual({
      status: 'resolved', winnerTokenId,
    })
  })

  it.each(['proposed', 'disputed', '', null, undefined])('does not settle non-final UMA status %s', (umaResolutionStatus) => {
    expect(inspectPredictionResolution({ ...final, umaResolutionStatus }, local).status).toBe('pending')
  })

  it('does not infer finality from expiry, closure or a price at one', () => {
    const { umaResolutionStatus, ...closed } = final
    expect(inspectPredictionResolution({ ...closed, endDate: '2000-01-01' }, local).status).toBe('pending')
    expect(inspectPredictionResolution({ ...final, closed: false }, local).status).toBe('pending')
  })

  it.each([
    { id: 'other' }, { conditionId: 'other' }, { conditionId: null },
    { clobTokenIds: '["no","yes"]' }, { clobTokenIds: '["yes","yes"]' },
    { outcomes: '["No","Yes"]' }, { outcomes: '["Yes",null,"No"]' },
    { outcomePrices: '["0.999","0.001"]' }, { outcomePrices: '["1","1"]' },
    { outcomePrices: '["0","0"]' }, { outcomePrices: '["0.5","0.5"]' },
    { outcomePrices: '["1",null,"0"]' }, { outcomePrices: '[1,0]' },
    { outcomePrices: 'not-json' },
  ])('requires unambiguous final identity and mapping: %j', (patch) => {
    expect(inspectPredictionResolution({ ...final, ...patch }, local).status).toBe('review')
  })

  it('rejects incomplete or duplicate local mappings', () => {
    expect(inspectPredictionResolution(final, { ...local, tokens: local.tokens.slice(0, 1) }).status).toBe('review')
    expect(inspectPredictionResolution(final, { ...local, tokens: [local.tokens[0], local.tokens[0]] }).status).toBe('review')
  })

  it('accepts upstream arrays without silently dropping malformed entries', () => {
    expect(inspectPredictionResolution({ ...final, outcomes: ['Yes', 'No'], clobTokenIds: ['yes', 'no'], outcomePrices: ['0', '1'] }, local))
      .toEqual({ status: 'resolved', winnerTokenId: 'no' })
  })
})

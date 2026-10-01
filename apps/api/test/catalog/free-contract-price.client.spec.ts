import { FreeContractPriceClient } from '../../src/catalog/free-contract-price.client'

describe('Free contract price feed', () => {
  const coin='ethereum:0x1234567890123456789012345678901234567890'
  const client=new FreeContractPriceClient()
  const original=global.fetch
  const fetchMock=jest.fn()
  beforeEach(()=> { global.fetch=fetchMock; fetchMock.mockReset() })
  afterAll(()=> { global.fetch=original })
  it('batches and deduplicates exact contracts without an API key or symbolic fallback', async()=> {
    fetchMock.mockResolvedValue({ok:true,json:async()=>({coins:{[coin]:{symbol:'REAL',price:1,timestamp:123,confidence:0.99},'coingecko:real':{symbol:'REAL',price:99}}})})
    expect(await client.get([coin,coin])).toEqual([{coin,symbol:'REAL',price:1,timestamp:123,confidence:0.99}])
    expect(fetchMock).toHaveBeenCalledWith(`https://coins.llama.fi/prices/current/${encodeURIComponent(coin)}?searchWidth=10m`,expect.objectContaining({redirect:'error',headers:{accept:'application/json'},signal:expect.any(AbortSignal)}))
  })
  it('does not replace a missing contract with a same-symbol token',async()=> {
    fetchMock.mockResolvedValue({ok:true,json:async()=>({coins:{'coingecko:real':{symbol:'REAL',price:99}}})})
    expect(await client.get([coin])).toEqual([])
  })
  it('rejects rate limits and malformed responses',async()=> {
    fetchMock.mockResolvedValueOnce({ok:false,status:429})
    await expect(client.get([coin])).rejects.toThrow('unavailable')
    fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({coins:[]})})
    await expect(client.get([coin])).rejects.toThrow('Invalid')
  })
  it('rejects malformed addresses and never contacts a caller-provided host',async()=> {
    await expect(client.get(['https://evil.example/token'])).rejects.toThrow('Invalid')
    await expect(client.get(['coingecko:arbitrary-underlying-token'])).rejects.toThrow('Invalid')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

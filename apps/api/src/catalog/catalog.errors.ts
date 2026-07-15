// 资产目录本地错误码（不修改共享 packages/contracts，遵守"不改现有代码"红线）
export const CATALOG_ERROR_CODES = {
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  ASSET_CLASS_NOT_FOUND: 'ASSET_CLASS_NOT_FOUND',
  DISCLOSURE_NOT_FOUND: 'DISCLOSURE_NOT_FOUND',
  QUOTE_STALE: 'QUOTE_STALE',
  PRODUCT_NOT_PUBLISHED: 'PRODUCT_NOT_PUBLISHED',
} as const

export type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[keyof typeof CATALOG_ERROR_CODES]

export class CatalogError extends Error {
  constructor(
    public readonly code: CatalogErrorCode,
    message: string,
    public readonly httpStatus: number = 404,
  ) {
    super(message)
    this.name = 'CatalogError'
  }

  static productNotFound(id: string): CatalogError {
    return new CatalogError(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND, `Product ${id} not found`, 404)
  }

  static assetClassNotFound(id: string): CatalogError {
    return new CatalogError(
      CATALOG_ERROR_CODES.ASSET_CLASS_NOT_FOUND,
      `Asset class ${id} not found`,
      404,
    )
  }

  static disclosureNotFound(id: string): CatalogError {
    return new CatalogError(
      CATALOG_ERROR_CODES.DISCLOSURE_NOT_FOUND,
      `Disclosure ${id} not found`,
      404,
    )
  }

  static quoteStale(productId: string): CatalogError {
    return new CatalogError(
      CATALOG_ERROR_CODES.QUOTE_STALE,
      `Latest quote for product ${productId} is stale; cannot price order`,
      409,
    )
  }

  static productNotPublished(id: string): CatalogError {
    return new CatalogError(
      CATALOG_ERROR_CODES.PRODUCT_NOT_PUBLISHED,
      `Product ${id} is not published`,
      409,
    )
  }
}

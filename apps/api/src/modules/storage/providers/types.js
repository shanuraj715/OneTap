/**
 * The storage adapter contract — the same pattern as payment gateways and
 * notification channels. Adding a backend is a new file plus a registry entry.
 *
 * @typedef {Object} ResolvedStorage
 * @property {import("@onetap/config-schema").StorageProvider} provider
 * @property {string} brandId
 * @property {string} outletId
 * @property {string} [publicBaseUrl]   CDN / custom domain in front of the store
 *
 * -- local only --
 * @property {string} [uploadsRoot]     absolute path the API writes to and serves
 * @property {string} [publicApiUrl]    this API's own origin, for the fallback URL
 *
 * -- s3 only --
 * @property {string} [bucket]
 * @property {string} [region]
 * @property {string} [endpoint]        set for non-AWS S3-compatible services
 * @property {string} [accessKeyId]
 * @property {string} [secretAccessKey]
 */

/**
 * @typedef {Object} PutInput
 * @property {string} key           store-relative path, e.g. "brand/outlet/menu-items/uuid.jpg"
 * @property {Buffer} body
 * @property {string} contentType
 */

/**
 * @typedef {Object} StorageAdapter
 * @property {import("@onetap/config-schema").StorageProvider} id
 * @property {(cfg: ResolvedStorage, input: PutInput) => Promise<{ url: string, key: string }>} put
 * @property {(cfg: ResolvedStorage, key: string) => Promise<void>} remove
 */

export {};

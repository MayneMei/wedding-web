declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    WEDDING_OWNER_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}

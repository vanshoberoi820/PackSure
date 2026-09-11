/* ─────────────────────────────────────────────
   AWS S3 Cloud Storage Engine
   Uploads product images and 360° inspection videos directly to Amazon S3
   ───────────────────────────────────────────── */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const region = import.meta.env.VITE_AWS_REGION || 'ap-south-1';
const bucket = import.meta.env.VITE_AWS_BUCKET_NAME;
const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;

let s3Client = null;

if (region && accessKeyId && secretAccessKey) {
  try {
    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  } catch (err) {
    console.warn('Failed to initialize S3 client:', err);
  }
}

/**
 * Upload a Base64 data URL or Blob to Amazon S3 and return the public HTTPS URL.
 * @param {string|Blob} dataUrlOrBlob
 * @param {string} filenamePrefix
 * @returns {Promise<string>}
 */
export async function uploadImageToS3(dataUrlOrBlob, filenamePrefix = 'inspection') {
  if (!dataUrlOrBlob) return null;

  if (!s3Client || !bucket) {
    console.log('S3 credentials/bucket not configured, using local image data.');
    return typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : URL.createObjectURL(dataUrlOrBlob);
  }

  try {
    let blob;
    let contentType = 'image/jpeg';

    if (typeof dataUrlOrBlob === 'string') {
      const res = await fetch(dataUrlOrBlob);
      blob = await res.blob();
      contentType = dataUrlOrBlob.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    } else {
      blob = dataUrlOrBlob;
      contentType = blob.type || 'image/jpeg';
    }

    const arrayBuffer = await blob.arrayBuffer();
    const isVideo = contentType.includes('video') || contentType.includes('webm') || contentType.includes('mp4');
    const extension = isVideo ? 'mp4' : contentType.includes('png') ? 'png' : 'jpg';
    const key = `inspections/${filenamePrefix}-${Date.now()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(arrayBuffer),
      ContentType: contentType,
    });

    await s3Client.send(command);

    const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    console.log('Successfully uploaded image to S3:', s3Url);
    return s3Url;
  } catch (error) {
    console.warn('S3 upload encountered an issue, using local fallback:', error);
    return typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : URL.createObjectURL(dataUrlOrBlob);
  }
}

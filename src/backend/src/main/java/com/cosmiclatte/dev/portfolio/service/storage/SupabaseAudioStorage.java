package com.cosmiclatte.dev.portfolio.service.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.cosmiclatte.dev.portfolio.common.exception.BadRequestException;
import com.cosmiclatte.dev.portfolio.common.exception.StorageException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Audio in Supabase Storage. The production implementation.
 *
 * <p>Talks the Storage REST API directly rather than pulling in the Supabase SDK:
 * three endpoints and one regex to pull the signed URL out of the response, which
 * is less code than the SDK's client surface and one less dependency to keep in
 * step with.
 */
@Service
@ConditionalOnProperty(
        name = "app.storage.backend", havingValue = "supabase", matchIfMissing = true)
public class SupabaseAudioStorage implements AudioStorage {

    private static final Logger log = LoggerFactory.getLogger(SupabaseAudioStorage.class);

    private static final Pattern SIGNED_URL_PATTERN =
            Pattern.compile("\"signedURL\"\\s*:\\s*\"([^\"]+)\"");

    private static final long SIGNED_URL_REFRESH_SKEW_MS = 60_000L;

    private final String storageBase;
    private final String bucket;
    private final String serviceKey;
    private final long maxBytes;
    private final long signedUrlExpiry;
    private final HttpClient http;
    private final ConcurrentHashMap<String, CachedUrl> signedUrlCache = new ConcurrentHashMap<>();

    public SupabaseAudioStorage(
            @Value("${app.supabase.url:}") String supabaseUrl,
            @Value("${app.supabase.bucket:music}") String bucket,
            @Value("${app.supabase.service-key:}") String serviceKey,
            @Value("${app.upload-max-bytes:20971520}") long maxBytes,
            @Value("${app.supabase.signed-url-expiry-seconds:3600}") long signedUrlExpiry) {
        this.storageBase = trimTrailingSlash(supabaseUrl) + "/storage/v1";
        this.bucket = bucket;
        this.serviceKey = serviceKey;
        this.maxBytes = maxBytes;
        this.signedUrlExpiry = signedUrlExpiry;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    }

    @Override
    public String store(MultipartFile file) {
        requireConfigured();
        AudioStorage.Rules.validate(file, maxBytes);
        String filename = AudioStorage.Rules.newObjectPath(file.getOriginalFilename());
        HttpResponse<String> resp = send(HttpRequest.newBuilder()
                .uri(URI.create(storageBase + "/object/" + bucket + "/" + filename))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", AudioStorage.Rules.contentTypeOf(file))
                .POST(HttpRequest.BodyPublishers.ofByteArray(readBytes(file))),
                "Could not upload audio to Supabase");
        require2xx(resp, "upload");
        return filename;
    }

    @Override
    public String storeArtwork(MultipartFile file) {
        requireConfigured();
        AudioStorage.Rules.validateArtwork(file);
        String filename = AudioStorage.Rules.newObjectPath(file.getOriginalFilename());
        HttpResponse<String> resp = send(HttpRequest.newBuilder()
                .uri(URI.create(storageBase + "/object/" + bucket + "/" + filename))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", AudioStorage.Rules.contentTypeOf(file))
                .POST(HttpRequest.BodyPublishers.ofByteArray(readBytes(file))), "Could not upload artwork to Supabase");
        require2xx(resp, "artwork upload");
        return filename;
    }

    @Override
    public String publicUrl(String objectPath) {
        requireConfigured();
        return storageBase.replace("/storage/v1", "/storage/v1/object/public") + "/" + bucket + "/" + objectPath;
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("Could not read the uploaded file: " + e.getMessage());
        }
    }

    @Override
    public void delete(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return;
        }
        requireConfigured();
        signedUrlCache.remove(objectPath);
        HttpResponse<String> resp = send(HttpRequest.newBuilder()
                .uri(URI.create(storageBase + "/object/" + bucket + "/" + objectPath))
                .timeout(Duration.ofSeconds(30))
                .DELETE(),
                "Could not delete audio from Supabase");
        int code = resp.statusCode();
        if (code >= 200 && code < 300) {
            return;
        }
        if (code == 400 || code == 404 || code == 410) {
            log.warn("Supabase delete {} -> treated as already non-existent ({})", objectPath, code);
            return;
        }
        throw new StorageException("Supabase delete failed (" + code + "): " + resp.body());
    }

    @Override
    public String signedUrl(String objectPath) {
        requireConfigured();
        CachedUrl cached = signedUrlCache.get(objectPath);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) {
            return cached.url();
        }
        String body = "{\"expiresIn\":" + signedUrlExpiry + "}";
        HttpResponse<String> resp = send(HttpRequest.newBuilder()
                .uri(URI.create(storageBase + "/object/sign/" + bucket + "/" + objectPath))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)),
                "Could not sign audio URL");
        require2xx(resp, "sign");
        String signedUrl = extractSignedUrl(resp.body());
        String absoluteUrl = signedUrl.startsWith("http") ? signedUrl : storageBase + signedUrl;
        long expiresAt = System.currentTimeMillis() + signedUrlExpiry * 1000L - SIGNED_URL_REFRESH_SKEW_MS;
        signedUrlCache.put(objectPath, new CachedUrl(absoluteUrl, expiresAt));
        return absoluteUrl;
    }

    /**
     * Sends a request with the service key attached. The interrupt flag is only
     * set for a real interrupt: a network error must not poison the pooled
     * servlet thread, or every later blocking call on it fails.
     */
    private HttpResponse<String> send(HttpRequest.Builder builder, String context) {
        builder.header("apikey", serviceKey);
        // Secret API keys are opaque; only legacy service-role keys are JWTs.
        if (!serviceKey.startsWith("sb_secret_")) {
            builder.header("Authorization", "Bearer " + serviceKey);
        }
        HttpRequest request = builder.build();
        try {
            return http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new StorageException(context + ": " + e.getMessage(), e);
        } catch (IOException e) {
            throw new StorageException(context + ": " + e.getMessage(), e);
        }
    }

    private void require2xx(HttpResponse<String> resp, String action) {
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new StorageException(
                    "Supabase " + action + " failed (" + resp.statusCode() + "): " + resp.body());
        }
    }

    private String extractSignedUrl(String body) {
        Matcher matcher = SIGNED_URL_PATTERN.matcher(body);
        if (matcher.find()) {
            return matcher.group(1);
        }
        throw new StorageException("Supabase did not return signedURL: " + body);
    }

    private void requireConfigured() {
        if (storageBase.equals("/storage/v1") || serviceKey.isBlank()) {
            throw new IllegalStateException(
                    "Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_STORAGE_SERVICE_KEY in .env, "
                            + "or run with app.storage.backend=local to store audio on disk instead.");
        }
    }

    private static String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }

    private record CachedUrl(String url, long expiresAt) {
    }
}

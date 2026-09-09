package com.cosmiclatte.dev.cosmiclatteweb.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

    private static final Pattern SIGNED_URL_PATTERN =
            Pattern.compile("\"signedURL\"\\s*:\\s*\"([^\"]+)\"");

    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
            "audio/ogg", "audio/webm", "audio/aac", "audio/flac",
            "audio/mp4", "audio/x-m4a", "video/mp4"
    );

    private static final List<String> ALLOWED_EXTENSIONS = List.of(
            ".mp3", ".wav", ".ogg", ".webm", ".aac", ".flac", ".m4a", ".mp4"
    );

    private final String storageBase;
    private final String bucket;
    private final String serviceKey;
    private final long maxBytes;
    private final long signedUrlExpiry;
    private final HttpClient http;

    public FileStorageService(
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

    public String store(MultipartFile file) {
        requireConfigured();
        validate(file);
        String filename = UUID.randomUUID() + extensionOf(file.getOriginalFilename());
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(storageBase + "/object/" + bucket + "/" + filename))
                    .timeout(Duration.ofSeconds(60))
                    .header("Authorization", "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .header("Content-Type", contentTypeOf(file))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
                    .build();
            HttpResponse<String> resp = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                throw new RuntimeException("Supabase upload failed (" + resp.statusCode() + "): " + resp.body());
            }
            return filename;
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Could not upload audio to Supabase: " + e.getMessage(), e);
        }
    }

    public void delete(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return;
        }
        requireConfigured();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(storageBase + "/object/" + bucket + "/" + objectPath))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .DELETE()
                    .build();
            HttpResponse<String> resp = http.send(request, HttpResponse.BodyHandlers.ofString());
            int code = resp.statusCode();
            if (code >= 200 && code < 300) {
                return;
            }
            if (code == 400 || code == 404 || code == 410) {
                log.warn("Supabase delete {} -> treated as already non-existent ({})", objectPath, code);
                return;
            }
            throw new RuntimeException("Supabase delete failed (" + code + "): " + resp.body());
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Could not delete audio from Supabase: " + e.getMessage(), e);
        }
    }

    public String signedUrl(String objectPath) {
        requireConfigured();
        try {
            String body = "{\"expiresIn\":" + signedUrlExpiry + "}";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(storageBase + "/object/sign/" + bucket + "/" + objectPath))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> resp = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                throw new RuntimeException("Supabase signed URL failed (" + resp.statusCode() + "): " + resp.body());
            }
            String signedUrl = extractSignedUrl(resp.body());
            return signedUrl.startsWith("http") ? signedUrl : storageBase + signedUrl;
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Could not sign audio URL: " + e.getMessage(), e);
        }
    }

    private String extractSignedUrl(String body) {
        Matcher matcher = SIGNED_URL_PATTERN.matcher(body);
        if (matcher.find()) {
            return matcher.group(1);
        }
        throw new RuntimeException("Supabase did not return signedURL: " + body);
    }

    private void requireConfigured() {
        if (storageBase.equals("/storage/v1") || serviceKey.isBlank()) {
            throw new IllegalStateException(
                    "Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_STORAGE_SERVICE_KEY in .env.");
        }
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Audio file is required.");
        }
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "File exceeds maximum size of " + (maxBytes / 1024 / 1024) + " MB.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("File type not allowed: " + contentType);
        }
        String extension = extensionOf(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("File extension not allowed: " + extension);
        }
    }

    private String extensionOf(String original) {
        if (original == null) {
            return "";
        }
        int dot = original.lastIndexOf('.');
        return dot >= 0 ? original.substring(dot).toLowerCase() : "";
    }

    private String contentTypeOf(MultipartFile file) {
        String ct = file.getContentType();
        if (ct != null && !ct.isBlank()) {
            return ct;
        }
        return switch (extensionOf(file.getOriginalFilename())) {
            case ".mp3" -> "audio/mpeg";
            case ".wav" -> "audio/wav";
            case ".ogg" -> "audio/ogg";
            case ".webm" -> "audio/webm";
            case ".aac" -> "audio/aac";
            case ".flac" -> "audio/flac";
            case ".m4a" -> "audio/mp4";
            case ".mp4" -> "video/mp4";
            default -> "application/octet-stream";
        };
    }

    private static String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }
}

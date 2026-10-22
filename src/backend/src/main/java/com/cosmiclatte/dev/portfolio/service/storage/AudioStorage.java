package com.cosmiclatte.dev.portfolio.service.storage;

import org.springframework.web.multipart.MultipartFile;

import com.cosmiclatte.dev.portfolio.common.exception.BadRequestException;

import java.util.List;

/**
 * Where uploaded audio lives.
 *
 * <p>Three operations, and that is the whole contract: {@link SongService} stores a
 * file when a track is created, drops one when it is replaced or deleted, and turns
 * the stored path into a playable URL on every read.
 *
 * <p>The split exists so local development needs no cloud account. Supabase stores
 * objects in production and a directory on disk does it locally, selected by
 * {@code app.storage.backend}. Everything above this interface — validation,
 * duration reading, the database rows, the response shape — is identical either
 * way, so what runs locally is what runs deployed.
 *
 * <p>Implementations return an <em>object path</em> (a UUID plus the original
 * extension) rather than a URL. That is what lands in {@code song.audio_url}, so
 * switching backends later cannot invalidate rows already stored.
 */
public interface AudioStorage {

    /** Validates and persists the upload, returning the object path to persist. */
    String store(MultipartFile file);

    default String storeArtwork(MultipartFile file) {
        Rules.validateArtwork(file);
        return store(file);
    }

    /**
     * Removes a stored object. Deleting something that is already gone is a
     * success, not an error: the row is being removed either way and a retry must
     * not fail on the cleanup.
     */
    void delete(String objectPath);

    /**
     * The playable URL for an object path. Supabase returns a signed URL that
     * expires; local disk returns a stable one on the backend itself.
     */
    String signedUrl(String objectPath);

    default String publicUrl(String objectPath) {
        return signedUrl(objectPath);
    }

    /**
     * Limits shared by both implementations.
     *
     * <p>Duplicating the limits in two classes would let local and production
     * disagree, which is the one failure this split cannot afford.
     */
    final class Rules {

        private Rules() {
        }

        public static final String FORMATS_HINT = "Allowed formats are .mp3, .wav and .flac.";

        public static void validateArtwork(MultipartFile file) {
            if (file == null || file.isEmpty()) throw new BadRequestException("Artwork image is required.");
            String extension = extensionOf(file.getOriginalFilename());
            long limit = switch (extension) {
                case ".jpg", ".jpeg" -> 2L * 1024 * 1024;
                case ".png" -> 6L * 1024 * 1024;
                default -> throw new BadRequestException("Artwork must be a JPG (2 MB max) or PNG (6 MB max).");
            };
            String expected = extension.equals(".png") ? "image/png" : "image/jpeg";
            if (!expected.equalsIgnoreCase(file.getContentType())) throw new BadRequestException("Artwork content type does not match its file extension.");
            if (file.getSize() > limit) throw new BadRequestException("Artwork exceeds the size limit for " + extension + ".");
        }

        public static final List<String> ALLOWED_CONTENT_TYPES = List.of(
                "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
                "audio/flac", "audio/x-flac", "audio/vnd.wave"
        );

        public static final List<String> ALLOWED_EXTENSIONS = List.of(
                ".mp3", ".wav", ".flac"
        );

        /**
         * Rejects anything the storage layer will not accept.
         *
         * <p>Empty is treated as absent rather than refused on content type: some
         * browsers omit the part's content type, and the extension is the
         * deterministic check. A <em>wrong</em> content type is still refused.
         */
        public static void validate(MultipartFile file, long maxBytes) {
            if (file == null || file.isEmpty()) {
                throw new BadRequestException("Audio file is required.");
            }
            if (file.getSize() > maxBytes) {
                throw new BadRequestException(
                        "File exceeds maximum size of " + (maxBytes / 1024 / 1024) + " MB.");
            }
            String contentType = file.getContentType();
            if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
                throw new BadRequestException("File type not allowed: " + contentType + ". " + FORMATS_HINT);
            }
            String extension = extensionOf(file.getOriginalFilename());
            if (!ALLOWED_EXTENSIONS.contains(extension)) {
                throw new BadRequestException(
                        "File extension not allowed: " + extension + ". " + FORMATS_HINT);
            }
        }

        public static String extensionOf(String original) {
            if (original == null) {
                return "";
            }
            int dot = original.lastIndexOf('.');
            return dot >= 0 ? original.substring(dot).toLowerCase() : "";
        }

        /**
         * A UUID plus the extension, which is both collision-free and safe to use
         * as a filename without escaping. The original name is never used, so a
         * caller cannot influence the path.
         */
        public static String newObjectPath(String original) {
            return java.util.UUID.randomUUID() + extensionOf(original);
        }

        public static String contentTypeOf(MultipartFile file) {
            String ct = file.getContentType();
            if (ct != null && !ct.isBlank()) {
                return ct;
            }
            return switch (extensionOf(file.getOriginalFilename())) {
                case ".mp3" -> "audio/mpeg";
                case ".wav" -> "audio/wav";
                case ".flac" -> "audio/flac";
                case ".jpg", ".jpeg" -> "image/jpeg";
                case ".png" -> "image/png";
                default -> "application/octet-stream";
            };
        }
    }
}

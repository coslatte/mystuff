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
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Audio on the local filesystem. The development implementation.
 *
 * <p>Exists so the whole upload path — admin form, validation, duration reading,
 * database rows, playback — runs without a Supabase account and without a network
 * round trip. Selected with {@code app.storage.backend=local}.
 *
 * <p>It writes the same object paths Supabase does (a UUID plus the extension),
 * so a database moved from one backend to the other keeps working, and it hands
 * back a URL on this backend rather than a signed one. Serving it is
 * {@code LocalAudioController}'s job; this class only owns the bytes.
 */
@Service
@ConditionalOnProperty(name = "app.storage.backend", havingValue = "local")
public class LocalDiskAudioStorage implements AudioStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalDiskAudioStorage.class);

    private final Path root;
    private final long maxBytes;
    private final String publicBaseUrl;

    public LocalDiskAudioStorage(
            @Value("${app.storage.local.directory:./data/audio}") String directory,
            @Value("${app.upload-max-bytes:20971520}") long maxBytes,
            @Value("${app.storage.local.public-base-url:}") String publicBaseUrl,
            @Value("${server.port:8080}") int serverPort) {
        this.root = Path.of(directory).toAbsolutePath().normalize();
        this.maxBytes = maxBytes;
        this.publicBaseUrl = trimTrailingSlash(publicBaseUrl.isBlank() ? "http://localhost:" + serverPort : publicBaseUrl);
    }

    /** The directory this backend writes to, exposed for the controller that serves it. */
    public Path root() {
        return root;
    }

    @Override
    public String store(MultipartFile file) {
        AudioStorage.Rules.validate(file, maxBytes);
        String objectPath = AudioStorage.Rules.newObjectPath(file.getOriginalFilename());

        Path temp = null;
        try {
            Files.createDirectories(root);
            // Written to a sibling temp file and moved into place, so a crash
            // mid-upload cannot leave a truncated file that reads as a valid track.
            temp = Files.createTempFile(root, ".upload-", ".part");
            long written;
            try (InputStream in = file.getInputStream(); OutputStream out = Files.newOutputStream(temp)) {
                written = in.transferTo(out);
            }
            // A short write means the multipart stream was already drained by
            // something upstream, and storing it would publish a silent, unplayable
            // track. Better to fail the upload than to save a zero-byte file.
            if (written != file.getSize()) {
                throw new StorageException(
                        "Audio stream was truncated while storing (" + written + " of " + file.getSize() + " bytes).");
            }
            Files.move(temp, resolve(objectPath), StandardCopyOption.REPLACE_EXISTING);
            temp = null;
        } catch (IOException e) {
            throw new StorageException("Could not write audio to " + root + ": " + e.getMessage(), e);
        } finally {
            // A leftover .part would otherwise accumulate in the store directory.
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException e) {
                    log.warn("Could not remove partial upload {}", temp, e);
                }
            }
        }
        log.info("Stored {} ({} bytes) on local disk", objectPath, file.getSize());
        return objectPath;
    }

    @Override
    public byte[] read(String objectPath) {
        try {
            return Files.readAllBytes(resolve(objectPath));
        } catch (IOException e) {
            throw new StorageException("Could not read audio from disk: " + e.getMessage(), e);
        }
    }

    @Override
    public String storePreview(byte[] mp3Bytes) {
        String objectPath = java.util.UUID.randomUUID() + ".mp3";
        try {
            Files.createDirectories(root);
            Files.write(resolve(objectPath), mp3Bytes);
            return objectPath;
        } catch (IOException e) {
            throw new StorageException("Could not store preview audio: " + e.getMessage(), e);
        }
    }

    @Override
    public void delete(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(objectPath));
        } catch (IOException e) {
            throw new StorageException("Could not delete audio from disk: " + e.getMessage(), e);
        }
    }

    @Override
    public String signedUrl(String objectPath) {
        // Stable rather than expiring: there is no secret to sign with locally, and
        // the endpoint is only mounted when this backend is the active one.
        return publicBaseUrl + "/api/local-audio/" + objectPath;
    }

    @Override
    public String storeArtwork(MultipartFile file) {
        AudioStorage.Rules.validateArtwork(file);
        String objectPath = AudioStorage.Rules.newObjectPath(file.getOriginalFilename());
        try {
            Files.createDirectories(root);
            Files.copy(file.getInputStream(), resolve(objectPath), StandardCopyOption.REPLACE_EXISTING);
            return objectPath;
        } catch (IOException e) {
            throw new StorageException("Could not write artwork to disk: " + e.getMessage(), e);
        }
    }

    @Override
    public String publicUrl(String objectPath) {
        return publicBaseUrl + "/api/local-audio/" + objectPath;
    }

    /**
     * Maps an object path onto a real file inside the root.
     *
     * <p>The name is rejected unless it is a plain file name, because this value
     * reaches here from a request as well as from the database. Anything with a
     * separator, a parent reference or a null byte is refused before it can walk
     * out of the root directory.
     */
    public Path resolve(String objectPath) {
        if (objectPath == null || !objectPath.matches("[A-Za-z0-9][A-Za-z0-9._-]*")
                || objectPath.contains("..")) {
            throw new BadRequestException("Invalid audio object path: " + objectPath);
        }
        Path resolved = root.resolve(objectPath).normalize();
        if (!resolved.startsWith(root)) {
            throw new BadRequestException("Invalid audio object path: " + objectPath);
        }
        return resolved;
    }

    private static String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }
}

package com.cosmiclatte.dev.portfolio.controller;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.core.io.AbstractResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cosmiclatte.dev.portfolio.common.exception.NotFoundException;
import com.cosmiclatte.dev.portfolio.service.storage.LocalDiskAudioStorage;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Serves audio stored by {@link LocalDiskAudioStorage}.
 *
 * <p>Only mounted when the local backend is active. In production Supabase serves
 * the bytes itself through a signed URL, and this endpoint does not exist, so
 * nothing is exposed beyond what the bucket already grants.
 *
 * <p>Under {@code /api/**} on purpose: that is where {@code WebConfig} already
 * points CORS, so playback works from the dev server without a second mapping.
 *
 * <p>Range requests are handled by hand because the waveform doubles as the seek
 * slider ({@code playback-canvas}): without {@code 206} responses the browser
 * cannot seek in a file it has not finished downloading.
 */
@RestController
@RequestMapping("/api/local-audio")
@ConditionalOnBean(LocalDiskAudioStorage.class)
public class LocalAudioController {

    private final LocalDiskAudioStorage storage;

    public LocalAudioController(LocalDiskAudioStorage storage) {
        this.storage = storage;
    }

    @GetMapping("/{objectPath:.+}")
    public ResponseEntity<Resource> read(
            @PathVariable String objectPath,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {

        Path file = storage.resolve(objectPath);
        if (!Files.isRegularFile(file)) {
            throw new NotFoundException("Audio not found: " + objectPath);
        }

        long size;
        try {
            size = Files.size(file);
        } catch (IOException e) {
            throw new NotFoundException("Audio not readable: " + objectPath);
        }

        MediaType contentType = contentTypeOf(objectPath);
        // 200 when the client asked for the whole file, 206 when it asked for a
        // slice. Either way the header advertises that ranges are available.
        if (range == null || !range.startsWith("bytes=")) {
            return ResponseEntity.ok()
                    .contentType(contentType)
                    .contentLength(size)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .body(new FileSystemResource(file));
        }

        long[] slice = parseRange(range, size);
        if (slice == null) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + size)
                    .build();
        }

        long start = slice[0];
        long end = slice[1];
        long length = end - start + 1;
        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .contentType(contentType)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + size)
                .contentLength(length)
                .body(new OffsetResource(file, start, length));
    }

    /**
     * Resolves a {@code bytes=} header into inclusive start and end offsets.
     *
     * <p>Handles the three shapes a browser sends: an explicit pair, an open end
     * ({@code bytes=500-}) and a suffix length ({@code bytes=-500}). Returns null
     * for anything unsatisfiable so the caller can answer 416 rather than guess.
     */
    private static long[] parseRange(String header, long size) {
        String spec = header.substring("bytes=".length()).trim();
        int comma = spec.indexOf(',');
        if (comma >= 0) {
            // Multipart ranges are legal but no player asks for audio in one, and
            // answering with the first range is what a single-range client expects.
            spec = spec.substring(0, comma).trim();
        }
        int dash = spec.indexOf('-');
        if (dash < 0) {
            return null;
        }
        String from = spec.substring(0, dash).trim();
        String to = spec.substring(dash + 1).trim();

        try {
            long start;
            long end;
            if (from.isEmpty()) {
                long suffix = Long.parseLong(to);
                if (suffix <= 0) {
                    return null;
                }
                start = Math.max(0, size - suffix);
                end = size - 1;
            } else {
                start = Long.parseLong(from);
                end = to.isEmpty() ? size - 1 : Long.parseLong(to);
            }
            if (start < 0 || start >= size || end < start) {
                return null;
            }
            return new long[]{start, Math.min(end, size - 1)};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static MediaType contentTypeOf(String objectPath) {
        String name = objectPath.toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
        if (name.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (name.endsWith(".mp3")) {
            return MediaType.parseMediaType("audio/mpeg");
        }
        if (name.endsWith(".wav")) {
            return MediaType.parseMediaType("audio/wav");
        }
        if (name.endsWith(".flac")) {
            return MediaType.parseMediaType("audio/flac");
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    /**
     * A read window onto a file, without loading it.
     *
     * <p>{@code ByteArrayResource} would pull a 20MB file into the heap to answer a
     * seek. This streams from the file and stops at the requested length. It extends
     * {@link AbstractResource} rather than {@code FileSystemResource} because that
     * class has no notion of an offset, and a record cannot extend a class at all.
     */
    private static final class OffsetResource extends AbstractResource {

        private final Path path;
        private final long offset;
        private final long length;

        OffsetResource(Path path, long offset, long length) {
            this.path = path;
            this.offset = offset;
            this.length = length;
        }

        @Override
        public InputStream getInputStream() throws IOException {
            InputStream in = Files.newInputStream(path);
            long skipped = 0;
            while (skipped < offset) {
                long n = in.skip(offset - skipped);
                if (n > 0) {
                    skipped += n;
                } else if (in.read() < 0) {
                    // File shorter than the client assumed; nothing left to skip.
                    break;
                } else {
                    skipped++;
                }
            }
            return new BoundedInputStream(in, length);
        }

        @Override
        public long contentLength() {
            return length;
        }

        @Override
        public String getDescription() {
            return path.getFileName().toString();
        }
    }

    private static final class BoundedInputStream extends FilterInputStream {
        private long remaining;

        BoundedInputStream(InputStream in, long limit) {
            super(in);
            this.remaining = limit;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int b = super.read();
            if (b >= 0) {
                remaining--;
            }
            return b;
        }

        @Override
        public int read(byte[] buffer, int off, int len) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int read = super.read(buffer, off, (int) Math.min(len, remaining));
            if (read > 0) {
                remaining -= read;
            }
            return read;
        }
    }
}

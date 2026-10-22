package com.cosmiclatte.dev.portfolio.service;

import com.cosmiclatte.dev.portfolio.common.exception.StorageException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Service
public class AudioPreviewService {

    private static final Logger log = LoggerFactory.getLogger(AudioPreviewService.class);

    private final String ffmpegPath;

    public AudioPreviewService(@Value("${app.audio.ffmpeg-path:ffmpeg}") String ffmpegPath) {
        this.ffmpegPath = ffmpegPath;
    }

    public byte[] encode128Kbps(byte[] source, String extension) {
        Path input = null;
        Path output = null;
        Process process = null;
        try {
            String suffix = extension != null && extension.matches("\\.[a-zA-Z0-9]{1,8}") ? extension : ".audio";
            input = Files.createTempFile("clm-share-source-", suffix);
            output = Files.createTempFile("clm-share-preview-", ".mp3");
            Files.write(input, source);
            process = new ProcessBuilder(ffmpegPath, "-nostdin", "-v", "error", "-y",
                    "-i", input.toString(), "-map", "0:a:0", "-map_metadata", "-1", "-vn", "-ac", "2",
                    "-codec:a", "libmp3lame", "-b:a", "128k",
                    "-ar", "44100", "-f", "mp3", output.toString())
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .start();
            if (!process.waitFor(Duration.ofMinutes(2).toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new StorageException("Audio preview conversion timed out.");
            }
            if (process.exitValue() != 0 || Files.size(output) == 0) {
                throw new StorageException("Could not convert audio for sharing.");
            }
            return Files.readAllBytes(output);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new StorageException("Audio preview conversion was interrupted.", e);
        } catch (IOException e) {
            throw new StorageException("Could not create the 128 kbps audio preview. Ensure FFmpeg is installed.", e);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
                process.onExit().join();
            }
            delete(input);
            delete(output);
        }
    }

    private void delete(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("Could not remove temporary preview file {}", path, e);
        }
    }
}

package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.common.exception.BadRequestException;
import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.audio.AudioHeader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;

@Service
public class AudioMetadataService {

    private static final Logger log = LoggerFactory.getLogger(AudioMetadataService.class);

    /**
     * Reads the track duration directly from the audio file metadata.
     * Supported containers are those with reliable duration info: .mp3, .wav and .flac.
     */
    public String readDuration(MultipartFile file) {
        File temp = null;
        try {
            String suffix = extensionOf(file.getOriginalFilename());
            temp = File.createTempFile("clm-audio-", suffix);
            file.transferTo(temp);
            AudioFile audioFile = AudioFileIO.read(temp);
            AudioHeader header = audioFile.getAudioHeader();
            int seconds = header.getTrackLength();
            if (seconds <= 0) {
                throw new BadRequestException(
                        "Could not determine audio duration. Allowed formats are .mp3, .wav, .flac.");
            }
            return format(seconds);
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Failed to read audio metadata: {}", e.getMessage());
            throw new BadRequestException(
                    "Could not read audio duration. Allowed formats are .mp3, .wav, .flac.");
        } finally {
            if (temp != null && temp.exists() && !temp.delete()) {
                log.warn("Could not delete temp audio file {}", temp.getAbsolutePath());
            }
        }
    }

    private String format(int totalSeconds) {
        int minutes = totalSeconds / 60;
        int seconds = totalSeconds % 60;
        return minutes + ":" + String.format("%02d", seconds);
    }

    private String extensionOf(String original) {
        if (original == null) {
            return ".tmp";
        }
        int dot = original.lastIndexOf('.');
        return dot >= 0 ? original.substring(dot).toLowerCase() : ".tmp";
    }
}

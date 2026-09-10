package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.common.exception.BadRequestException;
import com.cosmiclatte.dev.cosmiclatteweb.common.exception.NotFoundException;
import com.cosmiclatte.dev.cosmiclatteweb.dto.SongResponse;
import com.cosmiclatte.dev.cosmiclatteweb.mapper.SongMapper;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import com.cosmiclatte.dev.cosmiclatteweb.repository.RatingRepository;
import com.cosmiclatte.dev.cosmiclatteweb.repository.SongRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SongService {

    private final SongRepository songRepository;
    private final RatingRepository ratingRepository;
    private final FileStorageService fileStorage;
    private final SongMapper songMapper;

    public List<SongResponse> listSongs() {
        return songRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public SongResponse getSong(Long id) {
        return toResponse(findById(id));
    }

    @Transactional
    public SongResponse createSong(String title, String artist, String duration, MultipartFile file) {
        if (title == null || title.isBlank()) {
            throw new BadRequestException("Title is required.");
        }
        if (artist == null || artist.isBlank()) {
            throw new BadRequestException("Artist is required.");
        }
        String objectPath = fileStorage.store(file);
        Song song = Song.builder()
                .title(title.trim())
                .artist(artist.trim())
                .duration(duration != null ? duration.trim() : null)
                .audioUrl(objectPath)
                .build();
        return toResponse(songRepository.save(song));
    }

    @Transactional
    public SongResponse replaceAudio(Long id, MultipartFile file) {
        Song song = findById(id);
        String oldPath = song.getAudioUrl();
        String newPath = fileStorage.store(file);
        if (oldPath != null && !oldPath.isBlank()) {
            fileStorage.delete(oldPath);
        }
        song.setAudioUrl(newPath);
        return toResponse(songRepository.save(song));
    }

    @Transactional
    public void deleteSong(Long id) {
        Song song = findById(id);
        String path = song.getAudioUrl();
        if (path != null && !path.isBlank()) {
            fileStorage.delete(path);
        }
        songRepository.delete(song);
    }

    private Song findById(Long id) {
        return songRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Song not found: " + id));
    }

    private SongResponse toResponse(Song song) {
        long total = ratingRepository.countBySongId(song.getId());
        Double avg = total == 0 ? null : ratingRepository.avgStars(song);
        String audioUrl = song.getAudioUrl() == null ? null : fileStorage.signedUrl(song.getAudioUrl());
        return songMapper.toResponse(song, audioUrl, avg, total);
    }
}

package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.dto.SongResponse;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import com.cosmiclatte.dev.cosmiclatteweb.repository.RatingRepository;
import com.cosmiclatte.dev.cosmiclatteweb.repository.SongRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class SongService {

    private final SongRepository songRepository;
    private final RatingRepository ratingRepository;
    private final FileStorageService fileStorage;

    public SongService(
            SongRepository songRepository,
            RatingRepository ratingRepository,
            FileStorageService fileStorage) {
        this.songRepository = songRepository;
        this.ratingRepository = ratingRepository;
        this.fileStorage = fileStorage;
    }

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
            throw new IllegalArgumentException("El título es requerido.");
        }
        if (artist == null || artist.isBlank()) {
            throw new IllegalArgumentException("El artista es requerido.");
        }
        String objectPath = fileStorage.store(file);
        Song song = new Song();
        song.setTitle(title.trim());
        song.setArtist(artist.trim());
        song.setDuration(duration != null ? duration.trim() : null);
        song.setAudioUrl(objectPath);
        Song saved = songRepository.save(song);
        return toResponse(saved);
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Canción no encontrada: " + id));
    }

    private SongResponse toResponse(Song song) {
        long total = ratingRepository.countBySongId(song.getId());
        Double avg = total == 0 ? null : ratingRepository.avgStars(song);
        String audioUrl = song.getAudioUrl() == null ? null : fileStorage.signedUrl(song.getAudioUrl());
        return new SongResponse(
                song.getId(),
                song.getTitle(),
                song.getArtist(),
                song.getDuration(),
                audioUrl,
                song.getCreatedAt(),
                avg,
                total);
    }
}

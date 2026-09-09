package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.dto.SongResponse;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import com.cosmiclatte.dev.cosmiclatteweb.repository.RatingRepository;
import com.cosmiclatte.dev.cosmiclatteweb.repository.SongRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class SongService {

    private static final String FILE_PATH = "/api/files/";

    private final SongRepository songRepository;
    private final RatingRepository ratingRepository;
    private final FileStorageService fileStorage;
    private final String publicUrl;

    public SongService(
            SongRepository songRepository,
            RatingRepository ratingRepository,
            FileStorageService fileStorage,
            @Value("${app.public-url:http://localhost:8080}") String publicUrl) {
        this.songRepository = songRepository;
        this.ratingRepository = ratingRepository;
        this.fileStorage = fileStorage;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
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
        String filename = fileStorage.store(file);
        Song song = new Song();
        song.setTitle(title.trim());
        song.setArtist(artist.trim());
        song.setDuration(duration != null ? duration.trim() : null);
        song.setAudioUrl(FILE_PATH + filename);
        Song saved = songRepository.save(song);
        return toResponse(saved);
    }

    @Transactional
    public SongResponse replaceAudio(Long id, MultipartFile file) {
        Song song = findById(id);
        String oldUrl = song.getAudioUrl();
        String filename = fileStorage.store(file);
        if (oldUrl != null && oldUrl.startsWith(FILE_PATH)) {
            fileStorage.delete(oldUrl.substring(FILE_PATH.length()));
        }
        song.setAudioUrl(FILE_PATH + filename);
        return toResponse(songRepository.save(song));
    }

    @Transactional
    public void deleteSong(Long id) {
        Song song = findById(id);
        String url = song.getAudioUrl();
        songRepository.delete(song);
        if (url != null && url.startsWith(FILE_PATH)) {
            fileStorage.delete(url.substring(FILE_PATH.length()));
        }
    }

    private Song findById(Long id) {
        return songRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Canción no encontrada: " + id));
    }

    private SongResponse toResponse(Song song) {
        long total = ratingRepository.countBySongId(song.getId());
        Double avg = total == 0 ? null : ratingRepository.avgStars(song);
        String absoluteAudioUrl = song.getAudioUrl() == null ? null : publicUrl + song.getAudioUrl();
        return new SongResponse(
                song.getId(),
                song.getTitle(),
                song.getArtist(),
                song.getDuration(),
                absoluteAudioUrl,
                song.getCreatedAt(),
                avg,
                total);
    }
}

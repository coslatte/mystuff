package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.common.exception.BadRequestException;
import com.cosmiclatte.dev.cosmiclatteweb.common.exception.NotFoundException;
import com.cosmiclatte.dev.cosmiclatteweb.dto.SongResponse;
import com.cosmiclatte.dev.cosmiclatteweb.mapper.SongMapper;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import com.cosmiclatte.dev.cosmiclatteweb.repository.RatingRepository;
import com.cosmiclatte.dev.cosmiclatteweb.repository.RatingRepository.MyRating;
import com.cosmiclatte.dev.cosmiclatteweb.repository.RatingRepository.SongRatingSummary;
import com.cosmiclatte.dev.cosmiclatteweb.repository.SongRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SongService {

    private final SongRepository songRepository;
    private final RatingRepository ratingRepository;
    private final FileStorageService fileStorage;
    private final AudioMetadataService audioMetadata;
    private final SongMapper songMapper;

    public List<SongResponse> listSongs(String visitorId, String ipHash) {
        List<Song> songs = songRepository.findAllByOrderByCreatedAtDesc();
        if (songs.isEmpty()) {
            return List.of();
        }
        List<Long> songIds = songs.stream().map(Song::getId).toList();
        Map<Long, SongRatingSummary> summaries = Map.copyOf(ratingRepository.summarizeBySongIds(songIds).stream()
                .collect(Collectors.toMap(SongRatingSummary::getSongId, Function.identity())));
        MyRatings mine = loadMyRatings(songIds, visitorId, ipHash);
        return songs.parallelStream()
                .map(song -> toResponse(song, summaries.get(song.getId()), mine.pick(song.getId())))
                .toList();
    }

    public SongResponse getSong(Long id) {
        Song song = findById(id);
        SongRatingSummary summary = ratingRepository.summarizeBySongIds(List.of(id)).stream()
                .findFirst()
                .orElse(null);
        return toResponse(song, summary, null);
    }

    @Transactional
    public SongResponse createSong(String title, String artist, MultipartFile file) {
        if (title == null || title.isBlank()) {
            throw new BadRequestException("Title is required.");
        }
        if (artist == null || artist.isBlank()) {
            throw new BadRequestException("Artist is required.");
        }
        String duration = audioMetadata.readDuration(file);
        String objectPath = fileStorage.store(file);
        Song song = Song.builder()
                .title(title.trim())
                .artist(artist.trim())
                .duration(duration)
                .audioUrl(objectPath)
                .build();
        return toResponse(songRepository.save(song), null, null);
    }

    @Transactional
    public SongResponse replaceAudio(Long id, MultipartFile file) {
        Song song = findById(id);
        String oldPath = song.getAudioUrl();
        String duration = audioMetadata.readDuration(file);
        String newPath = fileStorage.store(file);
        if (oldPath != null && !oldPath.isBlank()) {
            fileStorage.delete(oldPath);
        }
        song.setAudioUrl(newPath);
        song.setDuration(duration);
        return toResponse(songRepository.save(song), null, null);
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

    private MyRatings loadMyRatings(List<Long> songIds, String visitorId, String ipHash) {
        String normalizedVisitor = visitorId == null || visitorId.isBlank() ? null : visitorId.trim();
        String normalizedIp = ipHash == null || ipHash.isBlank() ? null : ipHash;
        if (normalizedVisitor == null && normalizedIp == null) {
            return MyRatings.empty();
        }
        Map<Long, Integer> byVisitor = new HashMap<>();
        Map<Long, Integer> byIp = new HashMap<>();
        for (MyRating rating : ratingRepository.findMineForSongs(songIds, normalizedVisitor, normalizedIp)) {
            if (normalizedVisitor != null && normalizedVisitor.equals(rating.getVisitorId())) {
                byVisitor.put(rating.getSongId(), rating.getStars());
            } else {
                byIp.put(rating.getSongId(), rating.getStars());
            }
        }
        return new MyRatings(Map.copyOf(byVisitor), Map.copyOf(byIp));
    }

    private SongResponse toResponse(Song song, SongRatingSummary summary, Integer myRating) {
        long total = summary == null ? 0L : summary.getTotal();
        Double avg = total == 0 ? null : summary.getAverage();
        String audioUrl = song.getAudioUrl() == null ? null : fileStorage.signedUrl(song.getAudioUrl());
        return songMapper.toResponse(song, audioUrl, avg, total, myRating);
    }

    private record MyRatings(Map<Long, Integer> byVisitor, Map<Long, Integer> byIp) {

        static MyRatings empty() {
            return new MyRatings(Map.of(), Map.of());
        }

        Integer pick(Long songId) {
            Integer visitorStars = byVisitor.get(songId);
            return visitorStars != null ? visitorStars : byIp.get(songId);
        }
    }
}

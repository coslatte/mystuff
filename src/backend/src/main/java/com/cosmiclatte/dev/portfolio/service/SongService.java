package com.cosmiclatte.dev.portfolio.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import com.cosmiclatte.dev.portfolio.common.exception.BadRequestException;
import com.cosmiclatte.dev.portfolio.common.exception.NotFoundException;
import com.cosmiclatte.dev.portfolio.dto.SongResponse;
import com.cosmiclatte.dev.portfolio.mapper.SongMapper;
import com.cosmiclatte.dev.portfolio.model.Song;
import com.cosmiclatte.dev.portfolio.repository.CommentRepository;
import com.cosmiclatte.dev.portfolio.repository.RatingRepository;
import com.cosmiclatte.dev.portfolio.repository.SongRepository;
import com.cosmiclatte.dev.portfolio.repository.RatingRepository.MyRating;
import com.cosmiclatte.dev.portfolio.repository.RatingRepository.SongRatingSummary;
import com.cosmiclatte.dev.portfolio.repository.CommentRepository.SongCommentCount;
import com.cosmiclatte.dev.portfolio.service.storage.AudioStorage;

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
    private final CommentRepository commentRepository;
    /**
     * Audio storage is an interface so local development runs against disk and
     * production against Supabase. Everything in this class is identical either
     * way, which is the point of the split.
     */
    private final AudioStorage fileStorage;
    private final AudioMetadataService audioMetadata;
    private final SongMapper songMapper;
    private final SharedTrackService sharedTrackService;

    public List<SongResponse> listSongs(String visitorId, String ipHash) {
        List<Song> songs = songRepository.findAllByOrderByCreatedAtDesc();
        if (songs.isEmpty()) {
            return List.of();
        }
        List<Long> songIds = songs.stream().map(Song::getId).toList();
        Map<Long, SongRatingSummary> summaries = Map.copyOf(ratingRepository.summarizeBySongIds(songIds).stream()
                .collect(Collectors.toMap(SongRatingSummary::getSongId, Function.identity())));
        Map<Long, Long> commentCounts = commentRepository.countBySongIds(songIds).stream()
                .collect(Collectors.toMap(SongCommentCount::getSongId, SongCommentCount::getTotal));
        MyRatings mine = loadMyRatings(songIds, visitorId, ipHash);
        return songs.parallelStream()
                .map(song -> toResponse(song, summaries.get(song.getId()), mine.pick(song.getId()),
                        commentCounts.getOrDefault(song.getId(), 0L)))
                .toList();
    }

    public SongResponse getSong(Long id) {
        Song song = findById(id);
        SongRatingSummary summary = ratingRepository.summarizeBySongIds(List.of(id)).stream()
                .findFirst()
                .orElse(null);
        return toResponse(song, summary, null, commentCount(id));
    }

    @Transactional
    public SongResponse createSong(String title, String artist, MultipartFile file, MultipartFile artwork) {
        if (title == null || title.isBlank()) {
            throw new BadRequestException("Title is required.");
        }
        if (artist == null || artist.isBlank()) {
            throw new BadRequestException("Artist is required.");
        }
        String duration = audioMetadata.readDuration(file);
        String objectPath = fileStorage.store(file);
        deleteAfterRollback(objectPath);
        String artworkPath = artwork == null || artwork.isEmpty() ? null : fileStorage.storeArtwork(artwork);
        deleteAfterRollback(artworkPath);
        Song song = Song.builder()
                .title(title.trim())
                .artist(artist.trim())
                .duration(duration)
                .audioUrl(objectPath)
                .artworkUrl(artworkPath)
                .build();
        return toResponse(songRepository.save(song), null, null, 0L);
    }

    @Transactional
    public SongResponse replaceAudio(Long id, MultipartFile file) {
        Song song = songRepository.findForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Song not found: " + id));
        String oldPath = song.getAudioUrl();
        String duration = audioMetadata.readDuration(file);
        String newPath = fileStorage.store(file);
        deleteAfterRollback(newPath);
        sharedTrackService.refreshAudio(id, newPath);
        song.setAudioUrl(newPath);
        song.setDuration(duration);
        SongResponse response = toResponse(songRepository.save(song), null, null, commentCount(id));
        deleteAfterCommit(oldPath);
        return response;
    }

    @Transactional
    public void deleteSong(Long id) {
        Song song = songRepository.findForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Song not found: " + id));
        sharedTrackService.revoke(id);
        String path = song.getAudioUrl();
        String artworkPath = song.getArtworkUrl();
        songRepository.delete(song);
        deleteAfterCommit(path);
        deleteAfterCommit(artworkPath);
    }

    private void deleteAfterRollback(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) fileStorage.delete(objectPath);
            }
        });
    }

    /**
     * Removes the object once the transaction has committed. Deleting inside the
     * transaction would leave the row pointing at a file that is already gone if
     * the commit later rolled back.
     */
    private void deleteAfterCommit(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            fileStorage.delete(objectPath);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                fileStorage.delete(objectPath);
            }
        });
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

    private SongResponse toResponse(Song song, SongRatingSummary summary, Integer myRating, long commentCount) {
        long total = summary == null ? 0L : summary.getTotal();
        Double avg = total == 0 ? null : summary.getAverage();
        String audioUrl = song.getAudioUrl() == null ? null : fileStorage.signedUrl(song.getAudioUrl());
        String artworkUrl = song.getArtworkUrl() == null ? null : fileStorage.publicUrl(song.getArtworkUrl());
        return songMapper.toResponse(song, audioUrl, artworkUrl, avg, total, myRating, commentCount);
    }

    private long commentCount(Long songId) {
        return commentRepository.countBySongIds(List.of(songId)).stream()
                .mapToLong(SongCommentCount::getTotal)
                .findFirst()
                .orElse(0L);
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

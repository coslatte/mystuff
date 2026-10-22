package com.cosmiclatte.dev.portfolio.service;

import com.cosmiclatte.dev.portfolio.common.exception.NotFoundException;
import com.cosmiclatte.dev.portfolio.dto.SharedTrackResponse;
import com.cosmiclatte.dev.portfolio.mapper.SongMapper;
import com.cosmiclatte.dev.portfolio.model.SharedTrack;
import com.cosmiclatte.dev.portfolio.model.Song;
import com.cosmiclatte.dev.portfolio.repository.CommentRepository;
import com.cosmiclatte.dev.portfolio.repository.RatingRepository;
import com.cosmiclatte.dev.portfolio.repository.SharedTrackRepository;
import com.cosmiclatte.dev.portfolio.repository.SongRepository;
import com.cosmiclatte.dev.portfolio.service.storage.AudioStorage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SharedTrackService {

    private final SharedTrackRepository sharedTrackRepository;
    private final SongRepository songRepository;
    private final RatingRepository ratingRepository;
    private final CommentRepository commentRepository;
    private final AudioStorage storage;
    private final AudioPreviewService audioPreview;
    private final SongMapper songMapper;

    @Transactional
    public SharedTrackResponse createOrEnable(Long songId) {
        Song song = songRepository.findForUpdate(songId)
                .orElseThrow(() -> new NotFoundException("Song not found: " + songId));
        SharedTrack shared = sharedTrackRepository.findBySongId(songId).orElse(null);
        if (shared != null && shared.isActive()) return response(shared, song, null);

        if (song.getAudioUrl() == null || song.getAudioUrl().isBlank()) {
            throw new NotFoundException("Song audio not found.");
        }
        String newPreviewPath = createPreview(song.getAudioUrl());
        if (shared == null) {
            shared = new SharedTrack();
            shared.setSongId(songId);
        }
        shared.setToken(UUID.randomUUID().toString());
        String oldPreviewPath = shared.getPreviewAudioUrl();
        shared.setPreviewAudioUrl(newPreviewPath);
        shared.setActive(true);
        SharedTrack saved = sharedTrackRepository.save(shared);
        deleteAfterCommit(oldPreviewPath);
        return response(saved, song, null);
    }

    public SharedTrackResponse getActive(String token, String visitorId, String ipHash) {
        SharedTrack shared = sharedTrackRepository.findByTokenAndActiveTrue(token)
                .orElseThrow(() -> new NotFoundException("Shared track not found."));
        Song song = songRepository.findById(shared.getSongId())
                .orElseThrow(() -> new NotFoundException("Shared track not found."));
        var ratings = ratingRepository.findMineForSongs(List.of(song.getId()), visitorId, ipHash);
        Integer mine = ratings.stream().filter(r -> visitorId != null && visitorId.equals(r.getVisitorId()))
                .map(RatingRepository.MyRating::getStars).findFirst()
                .orElseGet(() -> ratings.stream().map(RatingRepository.MyRating::getStars).findFirst().orElse(null));
        return response(shared, song, mine);
    }

    public SharedTrackResponse getForSong(Long songId) {
        SharedTrack shared = sharedTrackRepository.findBySongId(songId)
                .filter(SharedTrack::isActive)
                .orElseThrow(() -> new NotFoundException("Shared track not found."));
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new NotFoundException("Song not found: " + songId));
        return response(shared, song, null);
    }

    @Transactional
    public void revoke(Long songId) {
        songRepository.findForUpdate(songId)
                .orElseThrow(() -> new NotFoundException("Song not found: " + songId));
        sharedTrackRepository.findBySongId(songId).ifPresent(shared -> {
            if (!shared.isActive()) return;
            String previewPath = shared.getPreviewAudioUrl();
            shared.setActive(false);
            shared.setPreviewAudioUrl("");
            sharedTrackRepository.save(shared);
            deleteAfterCommit(previewPath);
        });
    }

    @Transactional
    public void refreshAudio(Long songId, String sourcePath) {
        sharedTrackRepository.findBySongId(songId).filter(SharedTrack::isActive).ifPresent(shared -> {
            String oldPath = shared.getPreviewAudioUrl();
            shared.setPreviewAudioUrl(createPreview(sourcePath));
            sharedTrackRepository.save(shared);
            deleteAfterCommit(oldPath);
        });
    }

    private String createPreview(String sourcePath) {
        byte[] original = storage.read(sourcePath);
        byte[] preview = audioPreview.encode128Kbps(original, AudioStorage.Rules.extensionOf(sourcePath));
        String path = storage.storePreview(preview);
        // A failed database commit must not leave unpublished audio in storage.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) storage.delete(path);
            }
        });
        return path;
    }

    private SharedTrackResponse response(SharedTrack shared, Song song, Integer myRating) {
        var summary = ratingRepository.summarizeBySongIds(List.of(song.getId())).stream().findFirst().orElse(null);
        long votes = summary == null ? 0 : summary.getTotal();
        Double average = votes == 0 ? null : summary.getAverage();
        long comments = commentRepository.countBySongIds(List.of(song.getId())).stream()
                .mapToLong(CommentRepository.SongCommentCount::getTotal).findFirst().orElse(0L);
        String audioUrl = storage.signedUrl(shared.getPreviewAudioUrl());
        var songResponse = songMapper.toResponse(song, audioUrl,
                song.getArtworkUrl() == null ? null : storage.publicUrl(song.getArtworkUrl()),
                average, votes, myRating, comments);
        return new SharedTrackResponse(shared.getToken(), songResponse);
    }

    private void deleteAfterCommit(String path) {
        if (path == null || path.isBlank()) return;
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            storage.delete(path);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storage.delete(path);
            }
        });
    }
}

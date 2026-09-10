package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.common.exception.ForbiddenException;
import com.cosmiclatte.dev.cosmiclatteweb.common.exception.NotFoundException;
import com.cosmiclatte.dev.cosmiclatteweb.config.AdminAuth;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CommentResponse;
import com.cosmiclatte.dev.cosmiclatteweb.mapper.CommentMapper;
import com.cosmiclatte.dev.cosmiclatteweb.model.Comment;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import com.cosmiclatte.dev.cosmiclatteweb.repository.CommentRepository;
import com.cosmiclatte.dev.cosmiclatteweb.repository.SongRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CommentService {

    private static final Duration EDIT_WINDOW = Duration.ofMinutes(5);

    private final CommentRepository commentRepository;
    private final SongRepository songRepository;
    private final CommentMapper commentMapper;
    private final AdminAuth adminAuth;

    public List<CommentResponse> listBySong(Long songId) {
        return commentRepository.findBySongIdOrderByCreatedAtAsc(songId).stream()
                .map(commentMapper::toResponse)
                .toList();
    }

    @Transactional
    public CommentResponse create(Long songId, String author, String content) {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new NotFoundException("Song not found: " + songId));
        Comment comment = Comment.builder()
                .song(song)
                .author(author.trim())
                .content(content.trim())
                .build();
        return commentMapper.toResponse(commentRepository.save(comment));
    }

    @Transactional
    public CommentResponse update(Long commentId, String content, String adminKey, String editToken) {
        Comment comment = findById(commentId);
        boolean isAdmin = adminAuth.isAdmin(adminKey);
        boolean isOwner = editToken != null && editToken.equals(comment.getEditToken());
        if (!isAdmin && !isOwner) {
            throw new ForbiddenException("You don't have permission to edit this comment.");
        }
        if (!isAdmin && comment.getCreatedAt() != null
                && Duration.between(comment.getCreatedAt(), Instant.now()).compareTo(EDIT_WINDOW) > 0) {
            throw new ForbiddenException("The 5 minute edit window for this comment has expired.");
        }
        comment.setContent(content.trim());
        return commentMapper.toResponse(commentRepository.save(comment));
    }

    @Transactional
    public void delete(Long commentId, String adminKey) {
        if (!adminAuth.isAdmin(adminKey)) {
            throw new ForbiddenException("Admin key is required to delete comments.");
        }
        commentRepository.delete(findById(commentId));
    }

    private Comment findById(Long id) {
        return commentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Comment not found: " + id));
    }
}

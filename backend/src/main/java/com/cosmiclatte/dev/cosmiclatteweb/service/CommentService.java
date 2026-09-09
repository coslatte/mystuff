package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.config.AdminAuth;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CommentResponse;
import com.cosmiclatte.dev.cosmiclatteweb.model.Comment;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import com.cosmiclatte.dev.cosmiclatteweb.repository.CommentRepository;
import com.cosmiclatte.dev.cosmiclatteweb.repository.SongRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final SongRepository songRepository;
    private final AdminAuth adminAuth;

    public CommentService(CommentRepository commentRepository, SongRepository songRepository, AdminAuth adminAuth) {
        this.commentRepository = commentRepository;
        this.songRepository = songRepository;
        this.adminAuth = adminAuth;
    }

    public List<CommentResponse> listBySong(Long songId) {
        return commentRepository.findBySongIdOrderByCreatedAtAsc(songId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CommentResponse create(Long songId, String author, String content) {
        if (author == null || author.isBlank()) {
            throw new IllegalArgumentException("El autor es requerido.");
        }
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("El comentario no puede estar vacío.");
        }
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Canción no encontrada: " + songId));
        Comment comment = new Comment();
        comment.setSong(song);
        comment.setAuthor(author.trim());
        comment.setContent(content.trim());
        Comment saved = commentRepository.save(comment);
        return toResponse(saved);
    }

    @Transactional
    public CommentResponse update(Long commentId, String content, String adminKey, String editToken) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("El comentario no puede estar vacío.");
        }
        Comment comment = findById(commentId);
        boolean isAdmin = adminAuth.isAdmin(adminKey);
        boolean isOwner = editToken != null && editToken.equals(comment.getEditToken());
        if (!isAdmin && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No tienes permiso para editar este comentario.");
        }
        comment.setContent(content.trim());
        return toResponse(commentRepository.save(comment));
    }

    @Transactional
    public void delete(Long commentId, String adminKey) {
        if (!adminAuth.isAdmin(adminKey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Se requiere clave de administrador para eliminar comentarios.");
        }
        Comment comment = findById(commentId);
        commentRepository.delete(comment);
    }

    private Comment findById(Long id) {
        return commentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comentario no encontrado: " + id));
    }

    private CommentResponse toResponse(Comment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getSong().getId(),
                comment.getAuthor(),
                comment.getContent(),
                comment.getCreatedAt(),
                comment.getUpdatedAt(),
                comment.getEditToken());
    }
}

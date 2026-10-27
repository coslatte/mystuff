package com.cosmiclatte.dev.portfolio.service;

import com.cosmiclatte.dev.portfolio.common.exception.NotFoundException;
import com.cosmiclatte.dev.portfolio.dto.ForumNoteRequest;
import com.cosmiclatte.dev.portfolio.dto.ForumNoteResponse;
import com.cosmiclatte.dev.portfolio.model.ForumNote;
import com.cosmiclatte.dev.portfolio.repository.ForumNoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ForumNoteService {
    private final ForumNoteRepository repository;

    @Transactional(readOnly = true)
    public List<ForumNoteResponse> list() {
        return repository.findAllByOrderByUpdatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public ForumNoteResponse create(ForumNoteRequest request) {
        return toResponse(repository.save(fromRequest(new ForumNote(), request)));
    }

    @Transactional
    public ForumNoteResponse update(Long id, ForumNoteRequest request) {
        ForumNote note = repository.findById(id).orElseThrow(() -> new NotFoundException("Forum note not found."));
        return toResponse(repository.save(fromRequest(note, request)));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) throw new NotFoundException("Forum note not found.");
        repository.deleteById(id);
    }

    private ForumNote fromRequest(ForumNote note, ForumNoteRequest request) {
        note.setTitle(request.title().strip());
        note.setAuthor(request.author().strip());
        note.setContent(request.content());
        note.setStatus(request.status());
        return note;
    }

    private ForumNoteResponse toResponse(ForumNote note) {
        return new ForumNoteResponse(note.getId(), note.getTitle(), note.getAuthor(), note.getContent(),
                note.getStatus(), note.getCreatedAt(), note.getUpdatedAt());
    }
}

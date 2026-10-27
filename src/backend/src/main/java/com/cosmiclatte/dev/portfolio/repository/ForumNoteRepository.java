package com.cosmiclatte.dev.portfolio.repository;

import com.cosmiclatte.dev.portfolio.model.ForumNote;
import com.cosmiclatte.dev.portfolio.model.ForumNoteStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForumNoteRepository extends JpaRepository<ForumNote, Long> {
    List<ForumNote> findAllByOrderByUpdatedAtDesc();

    List<ForumNote> findAllByStatusOrderByUpdatedAtDesc(ForumNoteStatus status);
}

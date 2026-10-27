package com.cosmiclatte.dev.portfolio.repository;

import com.cosmiclatte.dev.portfolio.model.ForumNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForumNoteRepository extends JpaRepository<ForumNote, Long> {
    List<ForumNote> findAllByOrderByUpdatedAtDesc();
}

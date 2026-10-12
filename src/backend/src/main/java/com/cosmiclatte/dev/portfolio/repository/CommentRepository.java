package com.cosmiclatte.dev.portfolio.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cosmiclatte.dev.portfolio.model.Comment;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findBySongIdOrderByCreatedAtAsc(Long songId);
}

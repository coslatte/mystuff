package com.cosmiclatte.dev.cosmiclatteweb.repository;

import com.cosmiclatte.dev.cosmiclatteweb.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findBySongIdOrderByCreatedAtAsc(Long songId);

    void deleteBySongId(Long songId);
}

package com.cosmiclatte.dev.portfolio.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.cosmiclatte.dev.portfolio.model.Comment;

import java.util.Collection;
import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findBySongIdOrderByCreatedAtAsc(Long songId);

    @Query("""
            select c.song.id as songId, count(c) as total
            from Comment c
            where c.song.id in :songIds
            group by c.song.id
            """)
    List<SongCommentCount> countBySongIds(@Param("songIds") Collection<Long> songIds);

    interface SongCommentCount {
        Long getSongId();

        long getTotal();
    }
}

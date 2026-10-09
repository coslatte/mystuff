package com.cosmiclatte.dev.portfolio.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import com.cosmiclatte.dev.portfolio.dto.CommentResponse;
import com.cosmiclatte.dev.portfolio.dto.CreatedCommentResponse;
import com.cosmiclatte.dev.portfolio.model.Comment;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface CommentMapper {

    @Mapping(target = "songId", source = "song.id")
    CommentResponse toResponse(Comment comment);

    @Mapping(target = "songId", source = "song.id")
    CreatedCommentResponse toCreatedResponse(Comment comment);
}

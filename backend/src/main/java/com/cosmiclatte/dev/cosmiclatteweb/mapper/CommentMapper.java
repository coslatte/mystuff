package com.cosmiclatte.dev.cosmiclatteweb.mapper;

import com.cosmiclatte.dev.cosmiclatteweb.dto.CommentResponse;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CreatedCommentResponse;
import com.cosmiclatte.dev.cosmiclatteweb.model.Comment;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface CommentMapper {

    @Mapping(target = "songId", source = "song.id")
    CommentResponse toResponse(Comment comment);

    @Mapping(target = "songId", source = "song.id")
    CreatedCommentResponse toCreatedResponse(Comment comment);
}

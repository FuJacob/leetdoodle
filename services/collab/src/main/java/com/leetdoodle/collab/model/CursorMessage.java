package com.leetdoodle.collab.model;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import org.immutables.value.Value;

/**
 * Represents a cursor position update sent by a client.
 *
 * This message travels in both directions:
 *   Client → Server: "here is where my cursor is right now"
 *   Server → Client: "here is where another user's cursor is"
 *
 * Using the same shape in both directions keeps things simple. In a more
 * complex system you might separate InboundCursorMessage from
 * OutboundCursorMessage (e.g., to strip fields the client shouldn't see,
 * or to add server-side timestamps for ordering).
 *
 * WHY WORLD-SPACE COORDINATES?
 * We store x/y in "world space" — the coordinate system of the canvas itself,
 * independent of zoom or pan. The alternative would be "screen space" (pixels
 * from the top-left of the browser window). World space is correct here because
 * two users may be zoomed in to different levels: if user A is at 50% zoom and
 * user B is at 200% zoom, a screen-space coordinate means completely different
 * things to each of them. World-space coordinates always refer to the same point
 * on the canvas regardless of who is watching.
 */
@Value.Immutable
@JsonSerialize(as = ImmutableCursorMessage.class)
@JsonDeserialize(as = ImmutableCursorMessage.class)
public interface CursorMessage {
    String type();      // always "cursor"
    String canvasId();  // which canvas this cursor belongs to
    String userId();    // whose cursor this is
    double x();         // world-space X coordinate
    double y();         // world-space Y coordinate
}

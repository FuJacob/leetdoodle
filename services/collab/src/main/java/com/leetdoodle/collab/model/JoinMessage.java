package com.leetdoodle.collab.model;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import org.immutables.value.Value;

/**
 * Represents the first message a client sends after connecting.
 * It declares which canvas the client wants to join and who they are.
 *
 * WHY AN INTERFACE, NOT A CLASS?
 * Immutables works by reading an interface (or abstract class) and generating
 * a concrete implementation at compile time. The generated class is called
 * ImmutableJoinMessage. You never write that class — the annotation processor
 * creates it for you. The interface is just a contract: "this data has these fields".
 *
 * WHY IMMUTABLE OBJECTS?
 * In a concurrent system, shared mutable state is the #1 source of bugs. If
 * two threads both hold a reference to the same object and one modifies it,
 * the other sees a half-updated state. Immutable objects eliminate this class
 * of bug entirely — once created, they can never change, so sharing is always safe.
 *
 * WHY NOT JUST USE A RECORD (Java 16+)?
 * Records are great for simple cases. Immutables adds: null-safety enforcement,
 * derived fields, normalization, and richer builder patterns. For a learning
 * project, it's also worth seeing the annotation-processor pattern — it's used
 * heavily in the Java ecosystem (Lombok, MapStruct, Dagger, etc.).
 */
@Value.Immutable
// These two annotations tell Jackson (the JSON library) to use the generated
// ImmutableJoinMessage class when serializing/deserializing, not the interface.
@JsonSerialize(as = ImmutableJoinMessage.class)
@JsonDeserialize(as = ImmutableJoinMessage.class)
public interface JoinMessage {
    String type();      // always "join" — used to route the message in the handler
    String canvasId();  // which canvas room to join
    String userId();    // tab/session-scoped participant id
    @Value.Default
    default String displayName() {
        return "";
    }
}

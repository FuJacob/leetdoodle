package com.leetcanvas.collab.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.immutables.value.Generated;

/**
 * Immutable implementation of {@link JoinMessage}.
 * <p>
 * Use the builder to create immutable instances:
 * {@code ImmutableJoinMessage.builder()}.
 */
@Generated(from = "JoinMessage", generator = "Immutables")
@SuppressWarnings({"all"})
@javax.annotation.processing.Generated("org.immutables.processor.ProxyProcessor")
public final class ImmutableJoinMessage implements JoinMessage {
  private final String type;
  private final String canvasId;
  private final String userId;

  private ImmutableJoinMessage(String type, String canvasId, String userId) {
    this.type = type;
    this.canvasId = canvasId;
    this.userId = userId;
  }

  /**
   * @return The value of the {@code type} attribute
   */
  @JsonProperty("type")
  @Override
  public String type() {
    return type;
  }

  /**
   * @return The value of the {@code canvasId} attribute
   */
  @JsonProperty("canvasId")
  @Override
  public String canvasId() {
    return canvasId;
  }

  /**
   * @return The value of the {@code userId} attribute
   */
  @JsonProperty("userId")
  @Override
  public String userId() {
    return userId;
  }

  /**
   * Copy the current immutable object by setting a value for the {@link JoinMessage#type() type} attribute.
   * An equals check used to prevent copying of the same value by returning {@code this}.
   * @param value A new value for type
   * @return A modified copy of the {@code this} object
   */
  public final ImmutableJoinMessage withType(String value) {
    String newValue = Objects.requireNonNull(value, "type");
    if (this.type.equals(newValue)) return this;
    return new ImmutableJoinMessage(newValue, this.canvasId, this.userId);
  }

  /**
   * Copy the current immutable object by setting a value for the {@link JoinMessage#canvasId() canvasId} attribute.
   * An equals check used to prevent copying of the same value by returning {@code this}.
   * @param value A new value for canvasId
   * @return A modified copy of the {@code this} object
   */
  public final ImmutableJoinMessage withCanvasId(String value) {
    String newValue = Objects.requireNonNull(value, "canvasId");
    if (this.canvasId.equals(newValue)) return this;
    return new ImmutableJoinMessage(this.type, newValue, this.userId);
  }

  /**
   * Copy the current immutable object by setting a value for the {@link JoinMessage#userId() userId} attribute.
   * An equals check used to prevent copying of the same value by returning {@code this}.
   * @param value A new value for userId
   * @return A modified copy of the {@code this} object
   */
  public final ImmutableJoinMessage withUserId(String value) {
    String newValue = Objects.requireNonNull(value, "userId");
    if (this.userId.equals(newValue)) return this;
    return new ImmutableJoinMessage(this.type, this.canvasId, newValue);
  }

  /**
   * This instance is equal to all instances of {@code ImmutableJoinMessage} that have equal attribute values.
   * @return {@code true} if {@code this} is equal to {@code another} instance
   */
  @Override
  public boolean equals(Object another) {
    if (this == another) return true;
    return another instanceof ImmutableJoinMessage
        && equalTo(0, (ImmutableJoinMessage) another);
  }

  private boolean equalTo(int synthetic, ImmutableJoinMessage another) {
    return type.equals(another.type)
        && canvasId.equals(another.canvasId)
        && userId.equals(another.userId);
  }

  /**
   * Computes a hash code from attributes: {@code type}, {@code canvasId}, {@code userId}.
   * @return hashCode value
   */
  @Override
  public int hashCode() {
    int h = 5381;
    h += (h << 5) + type.hashCode();
    h += (h << 5) + canvasId.hashCode();
    h += (h << 5) + userId.hashCode();
    return h;
  }

  /**
   * Prints the immutable value {@code JoinMessage} with attribute values.
   * @return A string representation of the value
   */
  @Override
  public String toString() {
    return "JoinMessage{"
        + "type=" + type
        + ", canvasId=" + canvasId
        + ", userId=" + userId
        + "}";
  }

  /**
   * Utility type used to correctly read immutable object from JSON representation.
   * @deprecated Do not use this type directly, it exists only for the <em>Jackson</em>-binding infrastructure
   */
  @Generated(from = "JoinMessage", generator = "Immutables")
  @Deprecated
  @JsonDeserialize
  @JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.NONE)
  static final class Json implements JoinMessage {
    String type;
    String canvasId;
    String userId;
    @JsonProperty("type")
    public void setType(String type) {
      this.type = type;
    }
    @JsonProperty("canvasId")
    public void setCanvasId(String canvasId) {
      this.canvasId = canvasId;
    }
    @JsonProperty("userId")
    public void setUserId(String userId) {
      this.userId = userId;
    }
    @Override
    public String type() { throw new UnsupportedOperationException(); }
    @Override
    public String canvasId() { throw new UnsupportedOperationException(); }
    @Override
    public String userId() { throw new UnsupportedOperationException(); }
  }

  /**
   * @param json A JSON-bindable data structure
   * @return An immutable value type
   * @deprecated Do not use this method directly, it exists only for the <em>Jackson</em>-binding infrastructure
   */
  @Deprecated
  @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
  static ImmutableJoinMessage fromJson(Json json) {
    ImmutableJoinMessage.Builder builder = ImmutableJoinMessage.builder();
    if (json.type != null) {
      builder.type(json.type);
    }
    if (json.canvasId != null) {
      builder.canvasId(json.canvasId);
    }
    if (json.userId != null) {
      builder.userId(json.userId);
    }
    return builder.build();
  }

  /**
   * Creates an immutable copy of a {@link JoinMessage} value.
   * Uses accessors to get values to initialize the new immutable instance.
   * If an instance is already immutable, it is returned as is.
   * @param instance The instance to copy
   * @return A copied immutable JoinMessage instance
   */
  public static ImmutableJoinMessage copyOf(JoinMessage instance) {
    if (instance instanceof ImmutableJoinMessage) {
      return (ImmutableJoinMessage) instance;
    }
    return ImmutableJoinMessage.builder()
        .from(instance)
        .build();
  }

  /**
   * Creates a builder for {@link ImmutableJoinMessage ImmutableJoinMessage}.
   * <pre>
   * ImmutableJoinMessage.builder()
   *    .type(String) // required {@link JoinMessage#type() type}
   *    .canvasId(String) // required {@link JoinMessage#canvasId() canvasId}
   *    .userId(String) // required {@link JoinMessage#userId() userId}
   *    .build();
   * </pre>
   * @return A new ImmutableJoinMessage builder
   */
  public static ImmutableJoinMessage.Builder builder() {
    return new ImmutableJoinMessage.Builder();
  }

  /**
   * Builds instances of type {@link ImmutableJoinMessage ImmutableJoinMessage}.
   * Initialize attributes and then invoke the {@link #build()} method to create an
   * immutable instance.
   * <p><em>{@code Builder} is not thread-safe and generally should not be stored in a field or collection,
   * but instead used immediately to create instances.</em>
   */
  @Generated(from = "JoinMessage", generator = "Immutables")
  public static final class Builder {
    private static final long INIT_BIT_TYPE = 0x1L;
    private static final long INIT_BIT_CANVAS_ID = 0x2L;
    private static final long INIT_BIT_USER_ID = 0x4L;
    private long initBits = 0x7L;

    private String type;
    private String canvasId;
    private String userId;

    private Builder() {
    }

    /**
     * Fill a builder with attribute values from the provided {@code JoinMessage} instance.
     * Regular attribute values will be replaced with those from the given instance.
     * Absent optional values will not replace present values.
     * @param instance The instance from which to copy values
     * @return {@code this} builder for use in a chained invocation
     */
    public final Builder from(JoinMessage instance) {
      Objects.requireNonNull(instance, "instance");
      this.type(instance.type());
      this.canvasId(instance.canvasId());
      this.userId(instance.userId());
      return this;
    }

    /**
     * Initializes the value for the {@link JoinMessage#type() type} attribute.
     * @param type The value for type 
     * @return {@code this} builder for use in a chained invocation
     */
    @JsonProperty("type")
    public final Builder type(String type) {
      this.type = Objects.requireNonNull(type, "type");
      initBits &= ~INIT_BIT_TYPE;
      return this;
    }

    /**
     * Initializes the value for the {@link JoinMessage#canvasId() canvasId} attribute.
     * @param canvasId The value for canvasId 
     * @return {@code this} builder for use in a chained invocation
     */
    @JsonProperty("canvasId")
    public final Builder canvasId(String canvasId) {
      this.canvasId = Objects.requireNonNull(canvasId, "canvasId");
      initBits &= ~INIT_BIT_CANVAS_ID;
      return this;
    }

    /**
     * Initializes the value for the {@link JoinMessage#userId() userId} attribute.
     * @param userId The value for userId 
     * @return {@code this} builder for use in a chained invocation
     */
    @JsonProperty("userId")
    public final Builder userId(String userId) {
      this.userId = Objects.requireNonNull(userId, "userId");
      initBits &= ~INIT_BIT_USER_ID;
      return this;
    }

    /**
     * Builds a new {@link ImmutableJoinMessage ImmutableJoinMessage}.
     * @return An immutable instance of JoinMessage
     * @throws java.lang.IllegalStateException if any required attributes are missing
     */
    public ImmutableJoinMessage build() {
      if (initBits != 0) {
        throw new IllegalStateException(formatRequiredAttributesMessage());
      }
      return new ImmutableJoinMessage(type, canvasId, userId);
    }

    private String formatRequiredAttributesMessage() {
      List<String> attributes = new ArrayList<>();
      if ((initBits & INIT_BIT_TYPE) != 0) attributes.add("type");
      if ((initBits & INIT_BIT_CANVAS_ID) != 0) attributes.add("canvasId");
      if ((initBits & INIT_BIT_USER_ID) != 0) attributes.add("userId");
      return "Cannot build JoinMessage, some of required attributes are not set " + attributes;
    }
  }
}

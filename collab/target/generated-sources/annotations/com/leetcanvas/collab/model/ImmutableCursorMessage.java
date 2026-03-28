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
 * Immutable implementation of {@link CursorMessage}.
 * <p>
 * Use the builder to create immutable instances:
 * {@code ImmutableCursorMessage.builder()}.
 */
@Generated(from = "CursorMessage", generator = "Immutables")
@SuppressWarnings({"all"})
@javax.annotation.processing.Generated("org.immutables.processor.ProxyProcessor")
public final class ImmutableCursorMessage implements CursorMessage {
  private final String type;
  private final String canvasId;
  private final String userId;
  private final double x;
  private final double y;

  private ImmutableCursorMessage(String type, String canvasId, String userId, double x, double y) {
    this.type = type;
    this.canvasId = canvasId;
    this.userId = userId;
    this.x = x;
    this.y = y;
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
   * @return The value of the {@code x} attribute
   */
  @JsonProperty("x")
  @Override
  public double x() {
    return x;
  }

  /**
   * @return The value of the {@code y} attribute
   */
  @JsonProperty("y")
  @Override
  public double y() {
    return y;
  }

  /**
   * Copy the current immutable object by setting a value for the {@link CursorMessage#type() type} attribute.
   * An equals check used to prevent copying of the same value by returning {@code this}.
   * @param value A new value for type
   * @return A modified copy of the {@code this} object
   */
  public final ImmutableCursorMessage withType(String value) {
    String newValue = Objects.requireNonNull(value, "type");
    if (this.type.equals(newValue)) return this;
    return new ImmutableCursorMessage(newValue, this.canvasId, this.userId, this.x, this.y);
  }

  /**
   * Copy the current immutable object by setting a value for the {@link CursorMessage#canvasId() canvasId} attribute.
   * An equals check used to prevent copying of the same value by returning {@code this}.
   * @param value A new value for canvasId
   * @return A modified copy of the {@code this} object
   */
  public final ImmutableCursorMessage withCanvasId(String value) {
    String newValue = Objects.requireNonNull(value, "canvasId");
    if (this.canvasId.equals(newValue)) return this;
    return new ImmutableCursorMessage(this.type, newValue, this.userId, this.x, this.y);
  }

  /**
   * Copy the current immutable object by setting a value for the {@link CursorMessage#userId() userId} attribute.
   * An equals check used to prevent copying of the same value by returning {@code this}.
   * @param value A new value for userId
   * @return A modified copy of the {@code this} object
   */
  public final ImmutableCursorMessage withUserId(String value) {
    String newValue = Objects.requireNonNull(value, "userId");
    if (this.userId.equals(newValue)) return this;
    return new ImmutableCursorMessage(this.type, this.canvasId, newValue, this.x, this.y);
  }

  /**
   * Copy the current immutable object by setting a value for the {@link CursorMessage#x() x} attribute.
   * A value strict bits equality used to prevent copying of the same value by returning {@code this}.
   * @param value A new value for x
   * @return A modified copy of the {@code this} object
   */
  public final ImmutableCursorMessage withX(double value) {
    if (Double.doubleToLongBits(this.x) == Double.doubleToLongBits(value)) return this;
    return new ImmutableCursorMessage(this.type, this.canvasId, this.userId, value, this.y);
  }

  /**
   * Copy the current immutable object by setting a value for the {@link CursorMessage#y() y} attribute.
   * A value strict bits equality used to prevent copying of the same value by returning {@code this}.
   * @param value A new value for y
   * @return A modified copy of the {@code this} object
   */
  public final ImmutableCursorMessage withY(double value) {
    if (Double.doubleToLongBits(this.y) == Double.doubleToLongBits(value)) return this;
    return new ImmutableCursorMessage(this.type, this.canvasId, this.userId, this.x, value);
  }

  /**
   * This instance is equal to all instances of {@code ImmutableCursorMessage} that have equal attribute values.
   * @return {@code true} if {@code this} is equal to {@code another} instance
   */
  @Override
  public boolean equals(Object another) {
    if (this == another) return true;
    return another instanceof ImmutableCursorMessage
        && equalTo(0, (ImmutableCursorMessage) another);
  }

  private boolean equalTo(int synthetic, ImmutableCursorMessage another) {
    return type.equals(another.type)
        && canvasId.equals(another.canvasId)
        && userId.equals(another.userId)
        && Double.doubleToLongBits(x) == Double.doubleToLongBits(another.x)
        && Double.doubleToLongBits(y) == Double.doubleToLongBits(another.y);
  }

  /**
   * Computes a hash code from attributes: {@code type}, {@code canvasId}, {@code userId}, {@code x}, {@code y}.
   * @return hashCode value
   */
  @Override
  public int hashCode() {
    int h = 5381;
    h += (h << 5) + type.hashCode();
    h += (h << 5) + canvasId.hashCode();
    h += (h << 5) + userId.hashCode();
    h += (h << 5) + Double.hashCode(x);
    h += (h << 5) + Double.hashCode(y);
    return h;
  }

  /**
   * Prints the immutable value {@code CursorMessage} with attribute values.
   * @return A string representation of the value
   */
  @Override
  public String toString() {
    return "CursorMessage{"
        + "type=" + type
        + ", canvasId=" + canvasId
        + ", userId=" + userId
        + ", x=" + x
        + ", y=" + y
        + "}";
  }

  /**
   * Utility type used to correctly read immutable object from JSON representation.
   * @deprecated Do not use this type directly, it exists only for the <em>Jackson</em>-binding infrastructure
   */
  @Generated(from = "CursorMessage", generator = "Immutables")
  @Deprecated
  @JsonDeserialize
  @JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.NONE)
  static final class Json implements CursorMessage {
    String type;
    String canvasId;
    String userId;
    double x;
    boolean xIsSet;
    double y;
    boolean yIsSet;
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
    @JsonProperty("x")
    public void setX(double x) {
      this.x = x;
      this.xIsSet = true;
    }
    @JsonProperty("y")
    public void setY(double y) {
      this.y = y;
      this.yIsSet = true;
    }
    @Override
    public String type() { throw new UnsupportedOperationException(); }
    @Override
    public String canvasId() { throw new UnsupportedOperationException(); }
    @Override
    public String userId() { throw new UnsupportedOperationException(); }
    @Override
    public double x() { throw new UnsupportedOperationException(); }
    @Override
    public double y() { throw new UnsupportedOperationException(); }
  }

  /**
   * @param json A JSON-bindable data structure
   * @return An immutable value type
   * @deprecated Do not use this method directly, it exists only for the <em>Jackson</em>-binding infrastructure
   */
  @Deprecated
  @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
  static ImmutableCursorMessage fromJson(Json json) {
    ImmutableCursorMessage.Builder builder = ImmutableCursorMessage.builder();
    if (json.type != null) {
      builder.type(json.type);
    }
    if (json.canvasId != null) {
      builder.canvasId(json.canvasId);
    }
    if (json.userId != null) {
      builder.userId(json.userId);
    }
    if (json.xIsSet) {
      builder.x(json.x);
    }
    if (json.yIsSet) {
      builder.y(json.y);
    }
    return builder.build();
  }

  /**
   * Creates an immutable copy of a {@link CursorMessage} value.
   * Uses accessors to get values to initialize the new immutable instance.
   * If an instance is already immutable, it is returned as is.
   * @param instance The instance to copy
   * @return A copied immutable CursorMessage instance
   */
  public static ImmutableCursorMessage copyOf(CursorMessage instance) {
    if (instance instanceof ImmutableCursorMessage) {
      return (ImmutableCursorMessage) instance;
    }
    return ImmutableCursorMessage.builder()
        .from(instance)
        .build();
  }

  /**
   * Creates a builder for {@link ImmutableCursorMessage ImmutableCursorMessage}.
   * <pre>
   * ImmutableCursorMessage.builder()
   *    .type(String) // required {@link CursorMessage#type() type}
   *    .canvasId(String) // required {@link CursorMessage#canvasId() canvasId}
   *    .userId(String) // required {@link CursorMessage#userId() userId}
   *    .x(double) // required {@link CursorMessage#x() x}
   *    .y(double) // required {@link CursorMessage#y() y}
   *    .build();
   * </pre>
   * @return A new ImmutableCursorMessage builder
   */
  public static ImmutableCursorMessage.Builder builder() {
    return new ImmutableCursorMessage.Builder();
  }

  /**
   * Builds instances of type {@link ImmutableCursorMessage ImmutableCursorMessage}.
   * Initialize attributes and then invoke the {@link #build()} method to create an
   * immutable instance.
   * <p><em>{@code Builder} is not thread-safe and generally should not be stored in a field or collection,
   * but instead used immediately to create instances.</em>
   */
  @Generated(from = "CursorMessage", generator = "Immutables")
  public static final class Builder {
    private static final long INIT_BIT_TYPE = 0x1L;
    private static final long INIT_BIT_CANVAS_ID = 0x2L;
    private static final long INIT_BIT_USER_ID = 0x4L;
    private static final long INIT_BIT_X = 0x8L;
    private static final long INIT_BIT_Y = 0x10L;
    private long initBits = 0x1fL;

    private String type;
    private String canvasId;
    private String userId;
    private double x;
    private double y;

    private Builder() {
    }

    /**
     * Fill a builder with attribute values from the provided {@code CursorMessage} instance.
     * Regular attribute values will be replaced with those from the given instance.
     * Absent optional values will not replace present values.
     * @param instance The instance from which to copy values
     * @return {@code this} builder for use in a chained invocation
     */
    public final Builder from(CursorMessage instance) {
      Objects.requireNonNull(instance, "instance");
      this.type(instance.type());
      this.canvasId(instance.canvasId());
      this.userId(instance.userId());
      this.x(instance.x());
      this.y(instance.y());
      return this;
    }

    /**
     * Initializes the value for the {@link CursorMessage#type() type} attribute.
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
     * Initializes the value for the {@link CursorMessage#canvasId() canvasId} attribute.
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
     * Initializes the value for the {@link CursorMessage#userId() userId} attribute.
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
     * Initializes the value for the {@link CursorMessage#x() x} attribute.
     * @param x The value for x 
     * @return {@code this} builder for use in a chained invocation
     */
    @JsonProperty("x")
    public final Builder x(double x) {
      this.x = x;
      initBits &= ~INIT_BIT_X;
      return this;
    }

    /**
     * Initializes the value for the {@link CursorMessage#y() y} attribute.
     * @param y The value for y 
     * @return {@code this} builder for use in a chained invocation
     */
    @JsonProperty("y")
    public final Builder y(double y) {
      this.y = y;
      initBits &= ~INIT_BIT_Y;
      return this;
    }

    /**
     * Builds a new {@link ImmutableCursorMessage ImmutableCursorMessage}.
     * @return An immutable instance of CursorMessage
     * @throws java.lang.IllegalStateException if any required attributes are missing
     */
    public ImmutableCursorMessage build() {
      if (initBits != 0) {
        throw new IllegalStateException(formatRequiredAttributesMessage());
      }
      return new ImmutableCursorMessage(type, canvasId, userId, x, y);
    }

    private String formatRequiredAttributesMessage() {
      List<String> attributes = new ArrayList<>();
      if ((initBits & INIT_BIT_TYPE) != 0) attributes.add("type");
      if ((initBits & INIT_BIT_CANVAS_ID) != 0) attributes.add("canvasId");
      if ((initBits & INIT_BIT_USER_ID) != 0) attributes.add("userId");
      if ((initBits & INIT_BIT_X) != 0) attributes.add("x");
      if ((initBits & INIT_BIT_Y) != 0) attributes.add("y");
      return "Cannot build CursorMessage, some of required attributes are not set " + attributes;
    }
  }
}

from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Integer, String, Float, Boolean, DateTime, Date, ForeignKey,
    Text, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class CardCondition(str, enum.Enum):
    MINT = "M"
    NEAR_MINT = "NM"
    LIGHTLY_PLAYED = "LP"
    MODERATELY_PLAYED = "MP"
    HEAVILY_PLAYED = "HP"
    DAMAGED = "DMG"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    is_beta: Mapped[bool] = mapped_column(Boolean, default=False)  # early-adopter free premium
    contact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # phone/whatsapp/handle
    contact_public: Mapped[bool] = mapped_column(Boolean, default=False)
    collection_public: Mapped[bool] = mapped_column(Boolean, default=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Profile fields (added via ALTER on startup for existing DBs)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # emoji or small base64 image
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    links: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of {label, url}
    email_opt_out: Mapped[bool] = mapped_column(Boolean, default=False)  # opted out of campaign emails
    unsubscribe_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True, index=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)  # retention
    login_count: Mapped[int] = mapped_column(Integer, default=0)

    collection_entries: Mapped[List["CollectionEntry"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    binders: Mapped[List["Binder"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    decks: Mapped[List["Deck"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    wishlist: Mapped[List["WishlistEntry"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class CollectionEntry(Base):
    __tablename__ = "collection_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "scryfall_id", "condition", "foil", name="uq_collection_card"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    scryfall_id: Mapped[str] = mapped_column(String(64), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    condition: Mapped[str] = mapped_column(String(3), default=CardCondition.NEAR_MINT)
    foil: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[str] = mapped_column(String(10), default="en")
    price_at_add: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="collection_entries")
    binder_entries: Mapped[List["BinderCard"]] = relationship(back_populates="collection_entry", cascade="all, delete-orphan")


class Binder(Base):
    __tablename__ = "binders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#6366f1")
    icon: Mapped[str] = mapped_column(String(50), default="book")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="binders")
    cards: Mapped[List["BinderCard"]] = relationship(back_populates="binder", cascade="all, delete-orphan")


class BinderCard(Base):
    __tablename__ = "binder_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    binder_id: Mapped[int] = mapped_column(Integer, ForeignKey("binders.id"), index=True)
    collection_entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("collection_entries.id"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    page: Mapped[int] = mapped_column(Integer, default=0)   # physical location: page
    slot: Mapped[int] = mapped_column(Integer, default=0)   # physical location: pocket 1-9
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    binder: Mapped["Binder"] = relationship(back_populates="cards")
    collection_entry: Mapped["CollectionEntry"] = relationship(back_populates="binder_entries")


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    format: Mapped[str] = mapped_column(String(50), default="casual")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    primer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # strategy notes
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="decks")
    cards: Mapped[List["DeckCard"]] = relationship(back_populates="deck", cascade="all, delete-orphan")


class DeckCard(Base):
    __tablename__ = "deck_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deck_id: Mapped[int] = mapped_column(Integer, ForeignKey("decks.id"), index=True)
    scryfall_id: Mapped[str] = mapped_column(String(64))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    is_sideboard: Mapped[bool] = mapped_column(Boolean, default=False)
    is_commander: Mapped[bool] = mapped_column(Boolean, default=False)

    deck: Mapped["Deck"] = relationship(back_populates="cards")


class WishlistEntry(Base):
    __tablename__ = "wishlist_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "scryfall_id", name="uq_wishlist_card"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    scryfall_id: Mapped[str] = mapped_column(String(64))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    max_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # target price (alert)
    price_snapshot: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # price when added (baseline)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="wishlist")


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_friendship"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    addressee_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending | accepted
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Listing(Base):
    """A card offered for sale and/or trade (physical card)."""
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    scryfall_id: Mapped[str] = mapped_column(String(64), index=True)
    condition: Mapped[str] = mapped_column(String(3), default="NM")
    foil: Mapped[bool] = mapped_column(Boolean, default=False)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)   # for sale
    accepts_offers: Mapped[bool] = mapped_column(Boolean, default=False)   # sale: open to counter-offers
    wanted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)     # for trade (free text)
    wanted_cards: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list of cards accepted in trade
    photo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)      # real card photo (base64)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="active")      # active | closed | resolved
    resolved_as: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # sold | traded | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Interest(Base):
    """Someone expressed interest in a listing — also the chat thread between
    the buyer and the seller."""
    __tablename__ = "interests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(Integer, ForeignKey("listings.id"), index=True)
    buyer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # first note from the buyer
    status: Mapped[str] = mapped_column(String(12), default="open")      # open | sold | traded | cancelled
    # Per-user soft delete of the conversation (the other party keeps theirs).
    hidden_by_buyer: Mapped[bool] = mapped_column(Boolean, default=False)
    hidden_by_seller: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Message(Base):
    """A chat message within an interest thread (buyer ↔ seller)."""
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    interest_id: Mapped[int] = mapped_column(Integer, ForeignKey("interests.id"), index=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(20), default="bug")  # bug | suggestion | contact
    message: Mapped[str] = mapped_column(Text)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    page: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | resolved
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EmailCampaign(Base):
    """An email campaign (newsletter / announcement) sent to opted-in users."""
    __tablename__ = "email_campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(255), default="")          # big heading in the email
    body: Mapped[str] = mapped_column(Text, default="")                  # main text (supports simple line breaks)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # optional hero image URL
    cta_text: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    cta_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="draft")     # draft | sending | sent
    segment: Mapped[str] = mapped_column(String(20), default="all")      # all | inactive_14 | inactive_30
    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Store(Base):
    """A local game store in the public directory (admin-curated)."""
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    city: Mapped[str] = mapped_column(String(100), index=True)
    neighborhood: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    phone2: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instagram: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    logo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)        # URL or base64
    is_wpn: Mapped[bool] = mapped_column(Boolean, default=False)            # Wizards Play Network
    featured: Mapped[bool] = mapped_column(Boolean, default=False)          # promoted partner
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    calendar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # iCal/.ics feed (Google Calendar)
    calendar_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Event(Base):
    """An MTG event/tournament, optionally hosted by a Store. One-off (event_date)
    or weekly-recurring (weekday); recurring events are expanded for display."""
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    store_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("stores.id"), nullable=True, index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    format: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)   # Commander, Modern, Pauper...
    kind: Mapped[str] = mapped_column(String(20), default="tournament")        # fnm | tournament | casual | prerelease | other
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    entry_fee: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recurrence: Mapped[str] = mapped_column(String(10), default="none")        # none | weekly
    weekday: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)     # 0=Mon .. 6=Sun (weekly)
    event_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)    # one-off date
    time_label: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # "19:00"
    source: Mapped[str] = mapped_column(String(10), default="manual")          # manual | ical
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserEvent(Base):
    """An event created by a user (mesão, trade/sell, happening). Public events
    show on the organizer's profile; private ones are link-only."""
    __tablename__ = "user_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)  # organizer
    title: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(16), default="happening")   # mesao | trade | happening | other
    visibility: Mapped[str] = mapped_column(String(10), default="public")  # public | private
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    public_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True, index=True)  # private link
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EventInterest(Base):
    """A user marked interest in a UserEvent (gets emailed on changes)."""
    __tablename__ = "user_event_interests"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_interest"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_events.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EventComment(Base):
    """A comment on a UserEvent's page."""
    __tablename__ = "user_event_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_events.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Share(Base):
    """A share is either with a specific friend (friend_id set) or a public link
    (public_token set). resource_id is null for the whole collection."""
    __tablename__ = "shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    resource_type: Mapped[str] = mapped_column(String(20))  # collection | binder | deck
    resource_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    friend_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    public_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True, index=True)
    slug: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)  # pretty URL: /p/{username}/{slug}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

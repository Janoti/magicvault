from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Integer, String, Float, Boolean, DateTime, ForeignKey,
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

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
    max_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="wishlist")

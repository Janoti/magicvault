"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username'),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_username', 'users', ['username'])

    op.create_table('collection_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('scryfall_id', sa.String(64), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, default=1),
        sa.Column('condition', sa.String(3), nullable=False, default='NM'),
        sa.Column('foil', sa.Boolean(), nullable=False, default=False),
        sa.Column('language', sa.String(10), nullable=False, default='en'),
        sa.Column('price_at_add', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('added_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'scryfall_id', 'condition', 'foil', name='uq_collection_card'),
    )
    op.create_index('ix_collection_entries_user_id', 'collection_entries', ['user_id'])
    op.create_index('ix_collection_entries_scryfall_id', 'collection_entries', ['scryfall_id'])

    op.create_table('binders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color', sa.String(7), nullable=False, default='#6366f1'),
        sa.Column('icon', sa.String(50), nullable=False, default='book'),
        sa.Column('is_public', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_binders_user_id', 'binders', ['user_id'])

    op.create_table('binder_cards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('binder_id', sa.Integer(), sa.ForeignKey('binders.id'), nullable=False),
        sa.Column('collection_entry_id', sa.Integer(), sa.ForeignKey('collection_entries.id'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, default=0),
        sa.Column('added_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_binder_cards_binder_id', 'binder_cards', ['binder_id'])

    op.create_table('decks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('format', sa.String(50), nullable=False, default='casual'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_decks_user_id', 'decks', ['user_id'])

    op.create_table('deck_cards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deck_id', sa.Integer(), sa.ForeignKey('decks.id'), nullable=False),
        sa.Column('scryfall_id', sa.String(64), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, default=1),
        sa.Column('is_sideboard', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_commander', sa.Boolean(), nullable=False, default=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_deck_cards_deck_id', 'deck_cards', ['deck_id'])

    op.create_table('wishlist_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('scryfall_id', sa.String(64), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, default=1),
        sa.Column('max_price', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('added_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'scryfall_id', name='uq_wishlist_card'),
    )
    op.create_index('ix_wishlist_entries_user_id', 'wishlist_entries', ['user_id'])


def downgrade() -> None:
    op.drop_table('wishlist_entries')
    op.drop_table('deck_cards')
    op.drop_table('decks')
    op.drop_table('binder_cards')
    op.drop_table('binders')
    op.drop_table('collection_entries')
    op.drop_table('users')

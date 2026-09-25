"""Draws the world to a 320x180 canvas and integer-scales it to the screen."""

from __future__ import annotations

import random

import pygame

from kaiko import HEIGHT, WIDTH
from kaiko.art import KAIKO

BLACK = (0, 0, 0)
DEEP = (8, 22, 46)
PLAYER_BULLET = (255, 240, 160)
ENEMY_BULLET = (255, 96, 96)
HUD = (220, 236, 255)


class Background:
    def __init__(self, seed: int = 7):
        rng = random.Random(seed)
        self.far = [(rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT - 16)) for _ in range(45)]
        self.near = [(rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT - 16), rng.choice((2, 2, 3))) for _ in range(18)]
        self.rocks = [(rng.uniform(0, WIDTH * 2), rng.randint(4, 14), rng.randint(10, 26)) for _ in range(16)]

    def draw(self, c: pygame.Surface, t: float) -> None:
        for i in range(6):
            pygame.draw.rect(c, (DEEP[0] + i * 2, DEEP[1] + i * 4, DEEP[2] + i * 7), (0, i * 30, WIDTH, 30))
        for x, y in self.far:
            c.set_at((int((x - t * 12) % WIDTH), int(y)), (26, 64, 104))
        for x, y, s in self.near:
            pygame.draw.rect(c, (44, 110, 160), (int((x - t * 36) % WIDTH), int(y), s, s))
        pygame.draw.rect(c, (4, 12, 26), (0, HEIGHT - 10, WIDTH, 10))
        for x, h, w in self.rocks:
            rx = int((x - t * 48) % (WIDTH * 2)) - w
            pygame.draw.rect(c, (6, 16, 32), (rx, HEIGHT - 10 - h, w, h))


class Renderer:
    def __init__(self, windowed: bool):
        if windowed:
            self.screen = pygame.display.set_mode((1280, 720))
        else:
            self.screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
        pygame.display.set_caption("Kaiko")
        pygame.mouse.set_visible(windowed)
        self.canvas = pygame.Surface((WIDTH, HEIGHT))
        sw, sh = self.screen.get_size()
        self.scale = max(1, min(sw // WIDTH, sh // HEIGHT))
        self.offset = ((sw - WIDTH * self.scale) // 2, (sh - HEIGHT * self.scale) // 2)
        self.font = pygame.font.Font(None, 14)
        self.big = pygame.font.Font(None, 26)
        self.background = Background()
        icon_h = 6
        icon_w = max(1, round(KAIKO.width * icon_h / KAIKO.height))
        self._life_icon = pygame.transform.smoothscale(KAIKO.frames[0], (icon_w, icon_h))
        self._life_step = icon_w + 2

    def _blit_centered(self, surf: pygame.Surface, x: float, y: float) -> None:
        self.canvas.blit(surf, (round(x - surf.get_width() / 2), round(y - surf.get_height() / 2)))

    def _text(self, text: str, x: int, y: int, font=None, center=False) -> None:
        img = (font or self.font).render(text, False, HUD)
        if center:
            x -= img.get_width() // 2
        self.canvas.blit(img, (x, y))

    def draw(self, world, state: str) -> None:
        c = self.canvas
        self.background.draw(c, pygame.time.get_ticks() / 1000.0)
        for e in world.enemies:
            frame = e.sprite.flash_at(e.age) if e.flash > 0 else e.sprite.frame_at(e.age)
            self._blit_centered(frame, e.x, e.y)
        for b in world.enemy_bullets:
            if b.sprite is not None:
                self._blit_centered(b.sprite.frame_at(b.age), b.x, b.y)
            else:
                x, y, w, h = b.rect()
                pygame.draw.rect(c, ENEMY_BULLET, (round(x), round(y), w, h))
        for b in world.player_bullets:
            x, y, w, h = b.rect()
            pygame.draw.rect(c, PLAYER_BULLET, (round(x), round(y), w, h))
        p = world.player
        if p.alive and (p.invuln <= 0 or int(p.age * 20) % 2 == 0):
            self._blit_centered(p.sprite.frame_at(p.age), p.x, p.y)
        for pt in world.particles:
            c.set_at((int(pt.x) % WIDTH, int(pt.y) % HEIGHT), pt.color)
        self._text(f"SCORE {world.score:06d}", 4, 3)
        for i in range(p.lives):
            c.blit(self._life_icon, (WIDTH - 4 - self._life_step * (i + 1), 4))
        if state == "title":
            self._text("KAIKO", WIDTH // 2, 50, self.big, center=True)
            self._text("solve healthcare", WIDTH // 2, 72, center=True)
            self._text("arrows/WASD move   space fire   esc quit", WIDTH // 2, 110, center=True)
            self._text("press SPACE", WIDTH // 2, 130, center=True)
        elif state == "gameover":
            self._text("GAME OVER", WIDTH // 2, 60, self.big, center=True)
            self._text(f"score {world.score}", WIDTH // 2, 86, center=True)
            self._text("R restart   ESC quit", WIDTH // 2, 110, center=True)
        scaled = pygame.transform.scale(c, (WIDTH * self.scale, HEIGHT * self.scale))
        self.screen.fill(BLACK)
        self.screen.blit(scaled, self.offset)
        pygame.display.flip()

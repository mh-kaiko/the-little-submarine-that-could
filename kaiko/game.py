"""Main loop and game states."""

from __future__ import annotations

import pygame

from kaiko import DT, FPS
from kaiko.director import Director
from kaiko.render import Renderer
from kaiko.world import World


class Game:
    def __init__(self, classes, windowed: bool = False, seed: int | None = None, only: bool = False):
        self.classes = classes
        self.windowed = windowed
        self.seed = seed
        self.only = only
        self.state = "title"
        self.new_world()

    def new_world(self) -> None:
        self.world = World(seed=self.seed)
        self.director = Director(self.classes, only=self.only)

    def handle_key(self, key: int) -> bool:
        """Returns False when the game should quit."""
        if key == pygame.K_ESCAPE:
            return False
        if self.state == "title" and key == pygame.K_SPACE:
            self.state = "playing"
        elif self.state == "gameover" and key == pygame.K_r:
            self.new_world()
            self.state = "playing"
        return True

    def step(self, keys) -> None:
        if self.state != "playing":
            return
        dx = (keys[pygame.K_RIGHT] or keys[pygame.K_d]) - (keys[pygame.K_LEFT] or keys[pygame.K_a])
        dy = (keys[pygame.K_DOWN] or keys[pygame.K_s]) - (keys[pygame.K_UP] or keys[pygame.K_w])
        self.world.update(DT, dx, dy, bool(keys[pygame.K_SPACE]))
        self.director.update(DT, self.world)
        if not self.world.player.alive:
            self.state = "gameover"

    def run(self) -> None:
        pygame.init()
        renderer = Renderer(self.windowed)
        clock = pygame.time.Clock()
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    running = self.handle_key(event.key)
            self.step(pygame.key.get_pressed())
            renderer.draw(self.world, self.state)
            clock.tick(FPS)
        pygame.quit()

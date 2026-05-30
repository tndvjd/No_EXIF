"""
Grid layout templates for creating Instagram-style and magazine-style grids.
Each template defines cell positions as (row, col, row_span, col_span) on a virtual grid.
"""

from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass
class GridTemplate:
    """Represents a grid layout template."""
    name: str
    display_name: str
    description: str
    rows: int
    cols: int
    # Each cell is (row, col, row_span, col_span) in grid units
    cells: List[Tuple[int, int, int, int]]
    # Preview icon character
    icon: str = "▦"

    @property
    def total_cells(self) -> int:
        return len(self.cells)


# ===== Standard Grid Templates =====

GRID_1x1 = GridTemplate(
    name="1x1",
    display_name="1×1 단일",
    description="단일 이미지",
    rows=1, cols=1,
    cells=[(0, 0, 1, 1)],
    icon="■"
)

GRID_1x2 = GridTemplate(
    name="1x2",
    display_name="1×2 가로",
    description="가로 2칸 레이아웃",
    rows=1, cols=2,
    cells=[(0, 0, 1, 1), (0, 1, 1, 1)],
    icon="▬"
)

GRID_2x1 = GridTemplate(
    name="2x1",
    display_name="2×1 세로",
    description="세로 2칸 레이아웃",
    rows=2, cols=1,
    cells=[(0, 0, 1, 1), (1, 0, 1, 1)],
    icon="▮"
)

GRID_1x3 = GridTemplate(
    name="1x3",
    display_name="1×3 가로",
    description="가로 3칸 레이아웃 (인스타 한 줄)",
    rows=1, cols=3,
    cells=[(0, 0, 1, 1), (0, 1, 1, 1), (0, 2, 1, 1)],
    icon="≡"
)

GRID_2x2 = GridTemplate(
    name="2x2",
    display_name="2×2 정사각",
    description="2×2 정사각형 그리드",
    rows=2, cols=2,
    cells=[
        (0, 0, 1, 1), (0, 1, 1, 1),
        (1, 0, 1, 1), (1, 1, 1, 1),
    ],
    icon="▦"
)

GRID_2x3 = GridTemplate(
    name="2x3",
    display_name="2×3",
    description="2행 3열 그리드",
    rows=2, cols=3,
    cells=[
        (0, 0, 1, 1), (0, 1, 1, 1), (0, 2, 1, 1),
        (1, 0, 1, 1), (1, 1, 1, 1), (1, 2, 1, 1),
    ],
    icon="▦"
)

GRID_3x3 = GridTemplate(
    name="3x3",
    display_name="3×3 인스타",
    description="인스타그램 스타일 3×3 그리드",
    rows=3, cols=3,
    cells=[
        (0, 0, 1, 1), (0, 1, 1, 1), (0, 2, 1, 1),
        (1, 0, 1, 1), (1, 1, 1, 1), (1, 2, 1, 1),
        (2, 0, 1, 1), (2, 1, 1, 1), (2, 2, 1, 1),
    ],
    icon="▦"
)

GRID_2x4 = GridTemplate(
    name="2x4",
    display_name="2×4",
    description="2행 4열 그리드",
    rows=2, cols=4,
    cells=[
        (0, 0, 1, 1), (0, 1, 1, 1), (0, 2, 1, 1), (0, 3, 1, 1),
        (1, 0, 1, 1), (1, 1, 1, 1), (1, 2, 1, 1), (1, 3, 1, 1),
    ],
    icon="▦"
)

GRID_4x4 = GridTemplate(
    name="4x4",
    display_name="4×4",
    description="4×4 대형 그리드",
    rows=4, cols=4,
    cells=[
        (0, 0, 1, 1), (0, 1, 1, 1), (0, 2, 1, 1), (0, 3, 1, 1),
        (1, 0, 1, 1), (1, 1, 1, 1), (1, 2, 1, 1), (1, 3, 1, 1),
        (2, 0, 1, 1), (2, 1, 1, 1), (2, 2, 1, 1), (2, 3, 1, 1),
        (3, 0, 1, 1), (3, 1, 1, 1), (3, 2, 1, 1), (3, 3, 1, 1),
    ],
    icon="▦"
)


# ===== Magazine-style Templates =====

MAGAZINE_A = GridTemplate(
    name="mag_a",
    display_name="잡지 A - 히어로",
    description="큰 이미지 1개 + 작은 이미지 2개",
    rows=2, cols=2,
    cells=[
        (0, 0, 2, 1),  # Left: tall image spanning 2 rows
        (0, 1, 1, 1),  # Top-right
        (1, 1, 1, 1),  # Bottom-right
    ],
    icon="◧"
)

MAGAZINE_B = GridTemplate(
    name="mag_b",
    display_name="잡지 B - 피처",
    description="상단 큰 이미지 + 하단 작은 이미지 3개",
    rows=2, cols=3,
    cells=[
        (0, 0, 1, 3),  # Top: wide image spanning 3 cols
        (1, 0, 1, 1),  # Bottom-left
        (1, 1, 1, 1),  # Bottom-center
        (1, 2, 1, 1),  # Bottom-right
    ],
    icon="◫"
)

MAGAZINE_C = GridTemplate(
    name="mag_c",
    display_name="잡지 C - 갤러리",
    description="큰 이미지 1개 + 사이드 작은 이미지 3개",
    rows=3, cols=3,
    cells=[
        (0, 0, 3, 2),  # Left: large image spanning 3 rows, 2 cols
        (0, 2, 1, 1),  # Right-top
        (1, 2, 1, 1),  # Right-middle
        (2, 2, 1, 1),  # Right-bottom
    ],
    icon="◨"
)

MAGAZINE_D = GridTemplate(
    name="mag_d",
    display_name="잡지 D - 모자이크",
    description="다양한 크기의 모자이크 레이아웃",
    rows=3, cols=3,
    cells=[
        (0, 0, 2, 2),  # Top-left: large 2x2
        (0, 2, 1, 1),  # Top-right
        (1, 2, 1, 1),  # Middle-right
        (2, 0, 1, 1),  # Bottom-left
        (2, 1, 1, 1),  # Bottom-center
        (2, 2, 1, 1),  # Bottom-right
    ],
    icon="◩"
)

MAGAZINE_E = GridTemplate(
    name="mag_e",
    display_name="잡지 E - L자형",
    description="L자 형태 레이아웃",
    rows=2, cols=3,
    cells=[
        (0, 0, 1, 2),  # Top-left: wide
        (0, 2, 2, 1),  # Right: tall
        (1, 0, 1, 1),  # Bottom-left
        (1, 1, 1, 1),  # Bottom-center
    ],
    icon="◪"
)

MAGAZINE_F = GridTemplate(
    name="mag_f",
    display_name="잡지 F - 파노라마",
    description="상단 파노라마 + 하단 4칸",
    rows=3, cols=4,
    cells=[
        (0, 0, 1, 4),  # Top: panoramic spanning all 4 cols
        (1, 0, 2, 2),  # Bottom-left: large
        (1, 2, 1, 1),  # Middle-right-1
        (1, 3, 1, 1),  # Middle-right-2
        (2, 2, 1, 1),  # Bottom-right-1
        (2, 3, 1, 1),  # Bottom-right-2
    ],
    icon="▬"
)

MAGAZINE_G = GridTemplate(
    name="mag_g",
    display_name="잡지 G - 센터 포커스",
    description="중앙 큰 이미지 + 주변 작은 이미지",
    rows=3, cols=3,
    cells=[
        (0, 0, 1, 1),  # Top-left
        (0, 1, 1, 1),  # Top-center
        (0, 2, 1, 1),  # Top-right
        (1, 0, 1, 1),  # Middle-left
        (1, 1, 2, 2),  # Center: large 2x2
        (2, 0, 1, 1),  # Bottom-left
    ],
    icon="◆"
)

MAGAZINE_H = GridTemplate(
    name="mag_h",
    display_name="잡지 H - 크로스",
    description="십자 형태 레이아웃 (5장)",
    rows=4, cols=3,
    cells=[
        (0, 0, 2, 1),  # Left tall
        (0, 1, 1, 2),  # Top-right wide
        (1, 1, 1, 1),  # Center
        (1, 2, 1, 1),  # Right of center
        (2, 0, 2, 2),  # Bottom-left large
        (2, 2, 2, 1),  # Bottom-right tall
    ],
    icon="✚"
)

# ===== All templates in order =====
STANDARD_TEMPLATES = [
    GRID_1x1, GRID_1x2, GRID_2x1, GRID_1x3,
    GRID_2x2, GRID_2x3, GRID_3x3, GRID_2x4, GRID_4x4,
]

MAGAZINE_TEMPLATES = [
    MAGAZINE_A, MAGAZINE_B, MAGAZINE_C, MAGAZINE_D,
    MAGAZINE_E, MAGAZINE_F, MAGAZINE_G, MAGAZINE_H,
]

ALL_TEMPLATES = STANDARD_TEMPLATES + MAGAZINE_TEMPLATES


def get_template_by_name(name: str) -> GridTemplate:
    """Get a template by its name."""
    for t in ALL_TEMPLATES:
        if t.name == name:
            return t
    raise ValueError(f"Unknown template: {name}")

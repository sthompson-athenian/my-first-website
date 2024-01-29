// Source: https://blog.cogapp.com/art-institute-of-chicago-slide-puzzle-b5165d6fc779

const IMAGE_WIDTH = 600;
const MODES = ["Baby", "Toddler", "Teenager", "Adult", "Retired"];
const N_TILES_OPTIONS = [2, 3, 4, 5, 6];
const N_TILES =
  N_TILES_OPTIONS[Math.floor(Math.random() * N_TILES_OPTIONS.length)];
const MODE = MODES[N_TILES_OPTIONS.findIndex((mode) => mode == N_TILES)];
const N_ARTWORKS = 100;

const randomInt = (top) => Math.floor(Math.random() * top) + 1;

const getRandomArtwork = async (
  seed,
  fields = ["id", "title", "artist_id", "artist_title", "image_id"]
) => {
  try {
    const queryParams = new URLSearchParams({ fields });
    const response = await fetch(
      `https://api.artic.edu/api/v1/artworks/search?${queryParams.toString()}`,
      {
        method: "POST", // or 'PUT'
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          size: 1,
          from: seed,
        }),
      }
    );

    const result = await response.json();
    return result.data[0];
  } catch (error) {
    console.error("Error:", error);
  }
};

const artworkUrlById = (
  id,
  fields = ["id", "title", "artist_id", "artist_title", "image_id"]
) => {
  const queryParams = new URLSearchParams({ fields });
  return `https://api.artic.edu/api/v1/artworks/${id}?${queryParams.toString()}`;
};

const artworkSiteUrl = (id) => `https://www.artic.edu/artworks/${id}`;

const artistSiteUrl = (artist_id) =>
  `https://www.artic.edu/artists/${artist_id}`;

const infoJsonUrl = (image_id) =>
  `https://www.artic.edu/iiif/2/${image_id}/info.json`;

const iiifUrl = (image_id, region = "full", dimension = `${IMAGE_WIDTH},`) =>
  `https://www.artic.edu/iiif/2/${image_id}/${region}/${dimension}/0/default.jpg`;

const updateTitle = (id, title, artist_id, artist_title) => {
  const artworkLinkEl = document.createElement("a");
  artworkLinkEl.setAttribute("href", artworkSiteUrl(id));
  artworkLinkEl.innerText = title;

  const span = document.createElement("span");
  span.innerText = " by ";

  const artistLinkEl = document.createElement("a");
  artistLinkEl.setAttribute("href", artistSiteUrl(artist_id));
  artistLinkEl.innerText = artist_title;

  const titleEl = document.getElementById("title");
  titleEl.innerText = "";
  titleEl.appendChild(artworkLinkEl);
  titleEl.appendChild(span);
  titleEl.appendChild(artistLinkEl);
};

const getTileParams = (n, x, y) => {
  rows = Array.from(Array(n).keys());
  cols = Array.from(Array(n).keys());

  const tiles = [];
  for (const row of rows) {
    for (const col of cols) {
      tiles.push([(col * x) / n, (row * y) / n, x / n, y / n]);
    }
  }

  return tiles;
};

const generateTileUrls = (image_id, n, x, y) =>
  getTileParams(n, x, y).map((t) =>
    iiifUrl(image_id, `pct:${t.join(",")}`, `${IMAGE_WIDTH / n},`)
  );

const getImageUrls = async (image_id, n_tiles, idealSide = IMAGE_WIDTH) => {
  // get full dimensions from info.json
  const { width, height } = await fetch(infoJsonUrl(image_id)).then((res) =>
    res.json()
  );

  const requestCoords = { x: 100, y: 100 };
  // figure out required square as pct
  if (width > height) {
    // landscape
    const ratio = width / height;
    const maxSide = idealSide / ratio;
    requestCoords["x"] = (maxSide / idealSide) * 100;
    requestCoords["y"] = 100;
  } else {
    // portrait
    const ratio = height / width;
    const maxSide = idealSide / ratio;
    requestCoords["x"] = 100;
    requestCoords["y"] = (maxSide / idealSide) * 100;
  }

  return generateTileUrls(image_id, n_tiles, requestCoords.x, requestCoords.y);
};

const displayTiles = async (image_id, n_tiles, width) => {
  document.documentElement.style.setProperty("--tiles", n_tiles);
  document.documentElement.style.setProperty("--width", width);
  const imageUrls = await getImageUrls(image_id, n_tiles);
  const puzzleEl = document.getElementById("puzzle");
  imageUrls.forEach((src, i) => {
    const imageEl = document.createElement("img");
    imageEl.setAttribute("src", src);
    imageEl.setAttribute("draggable", false);
    imageEl.setAttribute("data-solved-coord", indexToCoord(i, n_tiles));
    puzzleEl.appendChild(imageEl);
  });
};

const shuffle = (n_tiles) => {
  const puzzleEl = document.getElementById("puzzle");
  // remove the last one as we need a blank space
  const movableTile = puzzleEl.lastChild;
  movableTile.setAttribute("data-src", movableTile.src);
  movableTile.setAttribute("src", "https://cogapplabs.github.io/aic-slide-puzzle/logo.png");
  movableTile.setAttribute("draggable", true);
  movableTile.classList.add("movable");

  Array.from(puzzleEl.childNodes).map((el, i) => {
    puzzleEl.appendChild(puzzleEl.childNodes[Math.floor(Math.random() * i)]);
  });

  Array.from(puzzleEl.childNodes).map((el, i) => {
    el.setAttribute("data-current-coord", indexToCoord(i, n_tiles));
  });
};

const parseCoord = (coord) => coord.split(",").map((i) => parseInt(i, 10));

const coordToIndex = (coord, n_tiles) => {
  const [x, y] = parseCoord(coord);
  return y * n_tiles + x;
};

const indexToCoord = (index, n_tiles) =>
  [index % n_tiles, Math.floor(index / n_tiles)].join(",");

const validCandidates = (dragSrcCoord, n_tiles) => {
  const [x, y] = parseCoord(dragSrcCoord);

  candidates = [];

  // up
  if (y > 0) {
    candidates.push([x, y - 1].join(","));
  }

  // right
  if (x < n_tiles) {
    candidates.push([x + 1, y].join(","));
  }

  // left
  if (x > 0) {
    candidates.push([x - 1, y].join(","));
  }

  // down
  if (y < n_tiles) {
    candidates.push([x, y + 1].join(","));
  }
  return candidates;
};

const initPuzzle = (seed, n_tiles, width) =>
  getRandomArtwork(seed)
    .then(async (data) => {
      updateTitle(data.id, data.title, data.artist_id, data.artist_title);
      await displayTiles(data.image_id, n_tiles, width);
    })
    .then(() => shuffle(n_tiles));

const swapTiles = (node1, node2) => {
  const puzzleEl = document.getElementById("puzzle");
  const node1Coord = node1.getAttribute("data-current-coord");
  const node2Coord = node2.getAttribute("data-current-coord");

  node1.setAttribute("data-current-coord", node2Coord);
  node2.setAttribute("data-current-coord", node1Coord);
  Array.from(puzzleEl.childNodes)
    .sort(
      (a, b) =>
        coordToIndex(a.getAttribute("data-current-coord"), N_TILES) -
        coordToIndex(b.getAttribute("data-current-coord"), N_TILES)
    )
    .map((el) => {
      puzzleEl.appendChild(el);
    });
};

const showHiddenPiece = () => {
  const movableTile = document.querySelector("[data-src]");
  movableTile.setAttribute("src", movableTile.getAttribute("data-src"));
};

const disablePuzzle = () => {
  const puzzleEl = document.getElementById("puzzle");
  Array.from(puzzleEl.childNodes).map((el) =>
    el.setAttribute("draggable", false)
  );
};

const updateProgress = () => {
  const puzzleEl = document.getElementById("puzzle");
  const tileState = Array.from(puzzleEl.childNodes).map(
    (el) =>
      el.getAttribute("data-current-coord") ==
      el.getAttribute("data-solved-coord")
  );
  const total = tileState.length;
  const totalSolved = tileState.filter(Boolean).length;
  const progressEl = document.getElementById("progress");
  if (totalSolved == total) {
    showHiddenPiece();
    disablePuzzle();
    progressEl.innerText = "Puzzle solved! You're free to leave...";
  } else {
    progressEl.innerText = `${MODE} mode - ${totalSolved} of ${total} tiles are in the right place.`;
  }
};

const setupDragLogic = (n_tiles) => {
  var dragSrcEl = null;
  var dragSrcCoord = null;

  function handleDragStart(e) {
    this.style.opacity = "0.4";
    dragSrcEl = this;
    dragSrcCoord = dragSrcEl.getAttribute("data-current-coord");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", this.innerHTML);
  }
  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
  }
  function handleDragEnter(e) {
    const candidateCoord = this.getAttribute("data-current-coord");
    if (validCandidates(dragSrcCoord, n_tiles).includes(candidateCoord)) {
      this.classList.add("over");
    }
  }
  function handleDragLeave(e) {
    this.classList.remove("over");
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation(); // stops the browser from redirecting.
    }
    const candidateCoord = this.getAttribute("data-current-coord");
    if (validCandidates(dragSrcCoord, n_tiles).includes(candidateCoord)) {
      swapTiles(dragSrcEl, this);
      updateProgress();
    }
  }
  function handleDragEnd(e) {
    this.style.opacity = "1";
    tiles.forEach(function (tile) {
      tile.classList.remove("over");
    });
  }
  const tiles = document.querySelectorAll("#puzzle img");
  tiles.forEach(function (tile) {
    tile.addEventListener("dragstart", handleDragStart, false);
    tile.addEventListener("dragenter", handleDragEnter, false);
    tile.addEventListener("dragover", handleDragOver, false);
    tile.addEventListener("dragleave", handleDragLeave, false);
    tile.addEventListener("drop", handleDrop, false);
    tile.addEventListener("dragend", handleDragEnd, false);
  });
};

async function main() {
  await initPuzzle(randomInt(N_ARTWORKS), N_TILES, IMAGE_WIDTH);
  updateProgress();
  setupDragLogic(N_TILES);
}

main();
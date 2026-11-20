// T58 — A dish's pictures in four shapes (square, landscape 4:3, wide 16:9, portrait 3:4): the API and selection rules, on a throwaway database (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t58-item-image-shapes-api",
  title: "Dish pictures in four shapes — square (default), landscape 4:3, wide 16:9, portrait 3:4 — stored, limited and chosen per card; existing square pictures untouched",
  area: "menu",
  browser: false,
  fresh: false,
  summary: "Runs suites/item-image-shapes-api.mjs on an in-memory API. A dish saved BEFORE shapes existed (pictures with no shape, written straight into the database) comes back with each picture as a square 1:1 one, with its address and file key exactly as it was; a card of any shape shows its first square picture so the dish looks the same as before; the pop-up still cycles through both squares; changing the price leaves the pictures alone and saving the form (which sends the pictures back) keeps them. Landscape, wide and portrait pictures are added next to the squares and kept in their own shape with their sizes; each card shape gets its own picture, and falls back to the first square one when the dish has none (a dish with only a wide picture still shows it on a square card; a dish with none shows nothing); a picture sent without a shape is stored as square. Limits: six squares, one each of landscape / wide / portrait (extras are dropped), nine in all, ten in one save is refused, a shape that doesn't exist (2:1) is refused. Importing a menu from another outlet brings every picture with its shape. The card variants ask for the right shape (photo-on-top and overlay 4:3, text-above and featured-wide 16:9, portrait 3:4, thumbnails and round cards square).",
  expect: [
    "A picture saved before shapes reads back as square with its file and address unchanged; nothing is removed or re-saved by reading or by saving other fields.",
    "Each shape is stored on the picture and returned by the menu; the selection falls back to the first square picture.",
    "Six square pictures and one of each other shape fit; more are dropped or refused; an unknown shape is refused.",
    "An imported menu keeps each picture's shape.",
  ],
  expectNot: [
    "An existing square picture must NOT be lost, re-ordered or changed to another shape.",
    "A dish must NOT end up with no picture on a card just because it lacks that shape, when it has any picture.",
    "A shape that doesn't exist must NOT be accepted.",
  ],
};

export const run = (d) => runSuite(d, "item-image-shapes-api.mjs");

import { Linking } from "react-native";
import { arrivedMessage, directionsUrl, geoUrl, openDirections, openLink, telUrl, tenDigits, whatsappUrl } from "@/features/maps";

const pin = { lat: 28.5355, lng: 77.391, text: "B-14, Sector 18, Noida" };

describe("directions go to the phone's own maps app (no map service, no key)", () => {
  it("the pin is the destination", () => {
    const url = directionsUrl(pin);
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=28\.5355,77\.391/);
    expect(url).not.toMatch(/key=/i);
  });
  it("with no pin the address in words is searched", () => {
    expect(directionsUrl({ lat: null, lng: null, text: "B-14, Sector 18" })).toBe("https://www.google.com/maps/search/?api=1&query=B-14%2C%20Sector%2018");
  });
  it("the generic map link of the phone, for when the first can't be opened", () => {
    expect(geoUrl(pin, "Order 7")).toBe("geo:28.5355,77.391?q=28.5355,77.391(Order%207)");
    expect(geoUrl({ lat: null, lng: null, text: "B-14" })).toBe("geo:0,0?q=B-14");
  });
});

describe("calls and WhatsApp", () => {
  it("a phone number to its last 10 digits", () => {
    expect(tenDigits("+91 98765 43210")).toBe("9876543210");
    expect(tenDigits("098765-43210")).toBe("9876543210");
    expect(tenDigits("12345")).toBe("");
  });
  it("a call link keeps only digits and a leading plus", () => expect(telUrl("+91 98765-43210")).toBe("tel:+919876543210"));
  it("a WhatsApp chat adds India's code to a 10-digit number, with an optional message", () => {
    expect(whatsappUrl("98765 43210")).toBe("https://wa.me/919876543210");
    expect(whatsappUrl("98765 43210", "Hello there")).toBe("https://wa.me/919876543210?text=Hello%20there");
    expect(whatsappUrl("")).toBe("");
    expect(whatsappUrl("12345")).toBe("");
  });
  it("the 'I'm outside' message names the customer and the order", () => {
    expect(arrivedMessage("Neha", "0007")).toMatch(/Hello Neha.*order #0007.*outside/);
    expect(arrivedMessage("", "0007")).toMatch(/^Hello,/);
  });
});

describe("opening a link", () => {
  afterEach(() => jest.restoreAllMocks());
  it("opens it in the app that handles it", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    expect(await openLink("tel:+919876543210")).toBe(true);
    expect(open).toHaveBeenCalledWith("tel:+919876543210");
  });
  it("says false when nothing can open it (and an empty link is never tried)", async () => {
    const open = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no app"));
    expect(await openLink("https://wa.me/919876543210")).toBe(false);
    open.mockClear();
    expect(await openLink("")).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
  it("directions try the maps link first, then the phone's generic map link", async () => {
    const open = jest.spyOn(Linking, "openURL").mockRejectedValueOnce(new Error("no browser")).mockResolvedValueOnce(undefined);
    expect(await openDirections(pin, "Order 7")).toBe(true);
    expect(open.mock.calls[0]![0]).toMatch(/^https:\/\/www\.google\.com\/maps\/dir/);
    expect(open.mock.calls[1]![0]).toMatch(/^geo:28\.5355,77\.391/);
  });
  it("directions say false when neither opens", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("nothing"));
    expect(await openDirections(pin)).toBe(false);
  });
});

// Server modules import "server-only", which throws outside React Server Components.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The private bucket stub photos live in. A photo can be uploaded only when
 * its stub could be posted, and a signed URL can be made only by someone who
 * can see the stub — so a friends-only photo never leaks through its link.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, anon, fixtures, going, makeFriends, minutesFromNow, openWindow, postStub, setMoment, type User } from "./support.mts";

const f = fixtures("photos");

// The smallest thing that is labelled a JPEG; storage checks the declared type.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

const uploaders = new Set<string>();
const upload = (u: User, path: string, contentType = "image/jpeg") => {
  uploaders.add(u.id);
  return u.db.storage.from("stubs").upload(path, JPEG, { contentType });
};

// Test photos go with the test users, so the local bucket does not fill up.
after(async () => {
  const bucket = admin.storage.from("stubs");
  for (const user of uploaders) {
    const { data: gigs } = await bucket.list(user);
    for (const gig of gigs ?? []) {
      const { data: files } = await bucket.list(`${user}/${gig.name}`);
      if (files?.length) await bucket.remove(files.map((file) => `${user}/${gig.name}/${file.name}`));
    }
  }
});

const canSign = async (db: SupabaseClient, path: string) =>
  !(await db.storage.from("stubs").createSignedUrl(path, 60)).error;

/** Uploads all three photos, then posts the stub, as the app will. */
async function posted(owner: User, audience: "friends" | "wall") {
  const gig = await f.gig();
  await going(owner, gig);
  await openWindow(gig);
  for (const name of ["back", "front", "thumb"]) {
    const { error } = await upload(owner, `${owner.id}/${gig}/${name}.jpg`);
    if (error) throw error;
  }
  const { error } = await postStub(owner, gig, audience);
  if (error) throw error;
  return `${owner.id}/${gig}/back.jpg`;
}

describe("uploading", () => {
  test("works into your own folder while the window is open", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await going(me, gig);
    await openWindow(gig);
    assert.equal((await upload(me, `${me.id}/${gig}/back.jpg`)).error, null);
  });

  test("is refused before the moment", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await going(me, gig);
    await setMoment(gig, minutesFromNow(5));
    assert.ok((await upload(me, `${me.id}/${gig}/back.jpg`)).error);
  });

  test("is refused for a gig you are not going to", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await openWindow(gig);
    assert.ok((await upload(me, `${me.id}/${gig}/back.jpg`)).error);
  });

  test("is refused into someone else's folder", async () => {
    const me = await f.user();
    const other = await f.user();
    const gig = await f.gig();
    await going(me, gig);
    await going(other, gig);
    await openWindow(gig);
    assert.ok((await upload(me, `${other.id}/${gig}/back.jpg`)).error);
  });

  test("is refused once your stub for that gig is posted", async () => {
    const me = await f.user();
    await posted(me, "wall");
    const gig = (await me.db.from("stubs").select("gig_id").eq("user_id", me.id).single()).data!.gig_id;
    assert.ok((await upload(me, `${me.id}/${gig}/extra.jpg`)).error);
  });

  test("only JPEGs, named the expected way", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await going(me, gig);
    await openWindow(gig);
    assert.ok((await upload(me, `${me.id}/${gig}/back.png`, "image/png")).error, "PNG refused");
    assert.ok((await upload(me, `${me.id}/${gig}/Back Photo.jpg`)).error, "odd file name refused");
  });

  test("signed out, nothing can be uploaded", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await openWindow(gig);
    const { error } = await anon().storage.from("stubs").upload(`${me.id}/${gig}/back.jpg`, JPEG, { contentType: "image/jpeg" });
    assert.ok(error);
  });
});

describe("viewing through signed URLs", () => {
  test("a friends-only photo: owner and friends yes, stranger and signed-out no", async () => {
    const owner = await f.user();
    const friend = await f.user();
    const stranger = await f.user();
    await makeFriends(owner, friend);
    const path = await posted(owner, "friends");

    assert.equal(await canSign(owner.db, path), true, "owner");
    assert.equal(await canSign(friend.db, path), true, "friend");
    assert.equal(await canSign(stranger.db, path), false, "stranger");
    assert.equal(await canSign(anon(), path), false, "signed out");
  });

  test("a wall photo: anyone, signed in or not", async () => {
    const owner = await f.user();
    const stranger = await f.user();
    const path = await posted(owner, "wall");
    assert.equal(await canSign(stranger.db, path), true);
    assert.equal(await canSign(anon(), path), true);
  });

  test("a blocked person cannot get a link even to a wall photo", async () => {
    const owner = await f.user();
    const blocked = await f.user();
    const path = await posted(owner, "wall");
    await owner.db.from("blocks").insert({ blocker_id: owner.id, blocked_id: blocked.id });
    assert.equal(await canSign(blocked.db, path), false);
  });

  test("the bucket cannot be listed by strangers", async () => {
    const owner = await f.user();
    const stranger = await f.user();
    await posted(owner, "friends");
    const { data } = await stranger.db.storage.from("stubs").list(owner.id);
    assert.deepEqual(data ?? [], []);
  });
});

describe("deleting", () => {
  test("the owner can delete their photos; nobody else can", async () => {
    const owner = await f.user();
    const friend = await f.user();
    await makeFriends(owner, friend);
    const path = await posted(owner, "wall");

    const tried = await friend.db.storage.from("stubs").remove([path]);
    assert.deepEqual(tried.data ?? [], [], "a friend's delete removes nothing");
    assert.equal(await canSign(owner.db, path), true, "still there");

    const done = await owner.db.storage.from("stubs").remove([path]);
    assert.equal(done.data?.length, 1);
  });
});

"use client";

import type {
  AmenityDto,
  LandlordListingDto,
  ListingImageDto,
  ListingStatus,
} from "@findme/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import {
  AuthApiError,
  getLandlordEntitlement,
  getOnboardingState,
  isAuthenticationSessionError,
  type LandlordEntitlement,
} from "../auth/auth-api";
import { BrandMark } from "../landing/brand-mark";
import {
  createLandlordListing,
  getLandlordListing,
  listAmenities,
  submitLandlordListing,
  updateLandlordListing,
  uploadListingPhoto,
} from "./landlord-listing-api";
import {
  MAX_LISTING_PHOTOS,
  buildCreateListingInput,
  buildUpdateListingInput,
  createInitialRentalFormValues,
  createRentalFormValuesFromListing,
  firstStepWithErrors,
  validatePhotoMetadata,
  validateRentalForSave,
  validateRentalStep,
  type ListingFormStep,
  type RentalFormErrors,
  type RentalFormValues,
} from "./listing-form-model";
import { RentalLocationPicker } from "./rental-location-picker";

interface LocalPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

interface CompletionState {
  listing: LandlordListingDto;
  photoCount: number;
  submitted: boolean;
}

const STEPS: ReadonlyArray<{
  number: ListingFormStep;
  label: string;
  labelKm: string;
}> = [
  { number: 1, label: "Rental details", labelKm: "ព័ត៌មានកន្លែងជួល" },
  { number: 2, label: "Map location", labelKm: "ទីតាំងលើផែនទី" },
  { number: 3, label: "Facilities", labelKm: "សម្ភារៈ និងការទាក់ទង" },
  { number: 4, label: "Photos & review", labelKm: "រូបថត និងពិនិត្យ" },
];

export function GuidedRentalForm({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<ListingFormStep>(1);
  const [values, setValues] = useState<RentalFormValues>(
    createInitialRentalFormValues,
  );
  const [amenities, setAmenities] = useState<AmenityDto[]>([]);
  const [entitlement, setEntitlement] = useState<LandlordEntitlement | null>(
    null,
  );
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [errors, setErrors] = useState<RentalFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [submitRequested, setSubmitRequested] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [uploadedPhotoIds, setUploadedPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const [existingListing, setExistingListing] =
    useState<LandlordListingDto | null>(null);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    async function load() {
      try {
        const onboarding = await getOnboardingState();
        if (!active) return;
        if (onboarding.role !== "LANDLORD" || onboarding.stage !== "COMPLETE") {
          router.replace(onboarding.nextPath);
          return;
        }
        const [access, availableAmenities, ownedListing] = await Promise.all([
          getLandlordEntitlement(),
          listAmenities(),
          listingId ? getLandlordListing(listingId) : Promise.resolve(null),
        ]);
        if (!active) return;
        if (ownedListing && !isEditableStatus(ownedListing.status)) {
          setLoadError(
            "This rental cannot be edited in its current publication state.",
          );
          setLoading(false);
          return;
        }
        setEntitlement(access);
        setAmenities(availableAmenities);
        setExistingListing(ownedListing);
        if (ownedListing) {
          setValues(createRentalFormValuesFromListing(ownedListing));
        }
        setLoading(false);
      } catch (caught) {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setLoadError(
          caught instanceof AuthApiError
            ? caught.message
            : "We could not prepare the rental form. Check your connection and try again.",
        );
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [listingId, loadAttempt, router]);

  const location = useMemo(() => {
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    return values.latitude &&
      values.longitude &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  }, [values.latitude, values.longitude]);

  const availableUnits = Number(values.availableUnits) || 0;
  const existingPhotos =
    existingListing?.images.filter((image) => image.status === "READY") ?? [];
  const updateLocation = useCallback(
    (next: {
      latitude: number;
      longitude: number;
      addressLine?: string;
      googlePlaceId?: string;
    }) => {
      setValues((current) => ({
        ...current,
        latitude: next.latitude.toFixed(6),
        longitude: next.longitude.toFixed(6),
        ...(next.addressLine ? { addressLine: next.addressLine } : {}),
        googlePlaceId: next.googlePlaceId ?? "",
      }));
      setErrors((current) =>
        omitErrors(current, ["latitude", "longitude", "addressLine"]),
      );
    },
    [],
  );

  function updateField<TKey extends keyof RentalFormValues>(
    field: TKey,
    value: RentalFormValues[TKey],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => omitErrors(current, [field]));
    setSaveError(null);
  }

  function goForward() {
    const stepErrors = validateRentalStep(values, step);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      focusFirstInvalidField();
      return;
    }
    if (step < 4) {
      setErrors({});
      setStep((step + 1) as ListingFormStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goBack() {
    if (step > 1) {
      setErrors({});
      setStep((step - 1) as ListingFormStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (
      existingPhotos.length + photos.length + selected.length >
      MAX_LISTING_PHOTOS
    ) {
      setErrors((current) => ({
        ...current,
        photos: `Choose no more than ${MAX_LISTING_PHOTOS} photos.`,
      }));
      return;
    }
    const invalid = selected
      .map(validatePhotoMetadata)
      .find((message): message is string => Boolean(message));
    if (invalid) {
      setErrors((current) => ({ ...current, photos: invalid }));
      return;
    }
    const added = selected.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.push(previewUrl);
      return { id: crypto.randomUUID(), file, previewUrl };
    });
    setPhotos((current) => [...current, ...added]);
    setErrors((current) => omitErrors(current, ["photos"]));
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter(
          (url) => url !== removed.previewUrl,
        );
      }
      return current.filter((photo) => photo.id !== photoId);
    });
    setUploadedPhotoIds((current) => {
      const next = new Set(current);
      next.delete(photoId);
      return next;
    });
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    setPhotos((current) => {
      const next = [...current];
      const first = next[index];
      const second = next[target];
      if (!first || !second) return current;
      next[index] = second;
      next[target] = first;
      return next;
    });
  }

  async function handleSave(submitForReview: boolean) {
    const validation = validateRentalForSave(values, {
      submitForReview,
      photoCount: existingPhotos.length + photos.length,
    });
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      setStep(firstStepWithErrors(validation));
      focusFirstInvalidField();
      return;
    }

    setPending(true);
    setSaveError(null);
    setSubmitRequested(submitForReview);
    let listing: LandlordListingDto;
    try {
      listing = existingListing
        ? await updateLandlordListing(
            existingListing.id,
            buildUpdateListingInput(values),
          )
        : await createLandlordListing(buildCreateListingInput(values));
    } catch (caught) {
      handleSaveError(caught);
      setPending(false);
      return;
    }
    setCreatedListingId(listing.id);
    try {
      await finishListing(listing, submitForReview, new Set());
    } catch (caught) {
      if (isAuthenticationSessionError(caught)) {
        router.replace("/login");
        return;
      }
      setSaveError(
        caught instanceof AuthApiError
          ? `Your draft is saved. ${caught.message}`
          : "Your draft is saved, but the remaining photos could not upload. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function finishListing(
    listing: LandlordListingDto,
    submitForReview: boolean,
    alreadyUploaded: Set<string>,
  ) {
    const uploaded = new Set(alreadyUploaded);
    for (const [index, photo] of photos.entries()) {
      if (uploaded.has(photo.id)) continue;
      const sortOrder = existingPhotos.length + index;
      const primaryTitle = values.titleKm.trim() || values.titleEn.trim();
      await uploadListingPhoto({
        listingId: listing.id,
        file: photo.file,
        sortOrder,
        ...(values.titleKm.trim()
          ? { altTextKm: `${primaryTitle} រូបទី ${sortOrder + 1}` }
          : { altTextEn: `${primaryTitle}, photo ${sortOrder + 1}` }),
      });
      uploaded.add(photo.id);
      setUploadedPhotoIds(new Set(uploaded));
    }
    const finalListing = submitForReview
      ? await submitLandlordListing(listing.id)
      : listing;
    setCompletion({
      listing: finalListing,
      photoCount: existingPhotos.length + uploaded.size,
      submitted: submitForReview,
    });
  }

  async function retryPhotoUpload() {
    if (!createdListingId) return;
    setPending(true);
    setSaveError(null);
    try {
      const listing = await getLandlordListing(createdListingId);
      await finishListing(listing, submitRequested, uploadedPhotoIds);
    } catch (caught) {
      if (isAuthenticationSessionError(caught)) {
        router.replace("/login");
        return;
      }
      setSaveError(
        caught instanceof AuthApiError
          ? caught.message
          : "Your draft is saved, but the remaining photos could not upload. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  function handleSaveError(caught: unknown) {
    if (isAuthenticationSessionError(caught)) {
      router.replace("/login");
      return;
    }
    if (caught instanceof AuthApiError && caught.fields.length > 0) {
      const apiErrors = Object.fromEntries(
        caught.fields.map(({ field, message }) => [
          toFormField(field),
          message,
        ]),
      );
      setErrors(apiErrors);
      setStep(firstStepWithErrors(apiErrors));
      focusFirstInvalidField();
    }
    setSaveError(
      caught instanceof AuthApiError
        ? caught.message
        : "We could not save this rental. Check your connection and try again.",
    );
  }

  if (loading) return <RentalFormLoading />;
  if (loadError) {
    return (
      <RentalFormShell>
        <section className="rental-form-message-panel" role="alert">
          <h1>Rental form unavailable</h1>
          <p>{loadError}</p>
          <button
            className="rental-primary-button"
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          >
            Try again
          </button>
        </section>
      </RentalFormShell>
    );
  }
  if (
    !listingId &&
    entitlement &&
    !entitlement.capabilities.canCreateListings
  ) {
    return (
      <RentalFormShell>
        <section className="rental-form-message-panel" role="alert">
          <p className="rental-state-label">Access ended</p>
          <h1>Your saved rental data is still here.</h1>
          <p>
            New rental creation is currently restricted. You can still open your
            landlord workspace and read existing rentals and inquiries.
          </p>
          <Link className="rental-primary-button" href="/landlord">
            Open landlord workspace
          </Link>
        </section>
      </RentalFormShell>
    );
  }
  if (completion) {
    return (
      <RentalFormShell>
        <section
          className="rental-form-message-panel rental-success-panel"
          role="status"
        >
          <p className="rental-state-label">Rental saved</p>
          <h1>
            {completion.submitted
              ? "Your rental is ready for review."
              : existingListing
                ? "Your rental changes are saved."
                : "Your draft is ready when you are."}
          </h1>
          <p>
            {completion.submitted
              ? "It remains private until an authorized moderator publishes it."
              : existingListing
                ? "The dashboard now shows the latest saved details."
                : "You can return to complete or submit it later."}
          </p>
          <dl className="rental-completion-summary">
            <div>
              <dt>Status</dt>
              <dd>{formatListingStatus(completion.listing.status)}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                {completion.listing.availableUnits} of{" "}
                {completion.listing.property.totalUnits} rooms
              </dd>
            </div>
            <div>
              <dt>Photos</dt>
              <dd>{completion.photoCount} uploaded</dd>
            </div>
          </dl>
          <div className="rental-success-actions">
            <Link className="rental-primary-button" href="/landlord">
              Open landlord workspace
            </Link>
            {!existingListing ? (
              <button
                className="rental-secondary-button"
                type="button"
                onClick={() => window.location.reload()}
              >
                Add another rental
              </button>
            ) : null}
          </div>
        </section>
      </RentalFormShell>
    );
  }
  if (createdListingId && saveError) {
    return (
      <RentalFormShell>
        <section className="rental-form-message-panel" role="alert">
          <p className="rental-state-label">Draft saved</p>
          <h1>Your rental details are safe.</h1>
          <p>{saveError}</p>
          <p>
            {uploadedPhotoIds.size} of {photos.length} photos uploaded. Keep
            this page open to retry the remaining files.
          </p>
          <div className="rental-success-actions">
            <button
              className="rental-primary-button"
              type="button"
              onClick={() => void retryPhotoUpload()}
              disabled={pending}
            >
              {pending ? "Retrying upload…" : "Retry photo upload"}
            </button>
            <Link className="rental-secondary-button" href="/landlord">
              Return to workspace
            </Link>
          </div>
        </section>
      </RentalFormShell>
    );
  }

  return (
    <RentalFormShell>
      <div className="guided-rental-layout">
        <aside
          className="rental-step-sidebar"
          aria-label="Rental setup progress"
        >
          <p className="rental-sidebar-label">
            {existingListing ? "Edit rental" : "New rental"}
          </p>
          <h1 id="rental-form-title">
            {existingListing
              ? "Keep your rental details accurate."
              : "Add the details students need."}
          </h1>
          <p>
            {existingListing
              ? "Changes stay private when the rental is not published. Availability is managed from the dashboard."
              : "Save a private draft from the review step. Nothing appears in student search before moderation and publication."}
          </p>
          <ol>
            {STEPS.map((item) => (
              <li
                key={item.number}
                data-state={
                  item.number === step
                    ? "current"
                    : item.number < step
                      ? "complete"
                      : "upcoming"
                }
                aria-current={item.number === step ? "step" : undefined}
              >
                <span aria-hidden="true">
                  {item.number < step ? "✓" : item.number}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small lang="km">{item.labelKm}</small>
                </div>
              </li>
            ))}
          </ol>
          {entitlement?.accessEndsAt ? (
            <p className="rental-trial-note">
              Trial access ends{" "}
              <time dateTime={entitlement.accessEndsAt}>
                {formatPhnomPenhDate(entitlement.accessEndsAt)}
              </time>
              .
            </p>
          ) : null}
        </aside>

        <section
          className="rental-form-surface"
          aria-labelledby="rental-form-title"
        >
          <div className="rental-mobile-progress">
            Step {step} of {STEPS.length}: {STEPS[step - 1]?.label}
          </div>
          <form onSubmit={(event) => event.preventDefault()} noValidate>
            {step === 1 ? (
              <RentalBasicsStep
                values={values}
                errors={errors}
                availabilityLocked={Boolean(existingListing)}
                updateField={updateField}
              />
            ) : null}
            {step === 2 ? (
              <RentalLocationStep
                values={values}
                errors={errors}
                location={location}
                availableUnits={availableUnits}
                availabilityLocked={Boolean(existingListing)}
                updateField={updateField}
                updateLocation={updateLocation}
              />
            ) : null}
            {step === 3 ? (
              <RentalFacilitiesStep
                values={values}
                errors={errors}
                amenities={amenities}
                updateField={updateField}
              />
            ) : null}
            {step === 4 ? (
              <RentalReviewStep
                values={values}
                errors={errors}
                amenities={amenities}
                photos={photos}
                existingPhotos={existingPhotos}
                canManagePhotos={Boolean(
                  entitlement?.capabilities.canCreateListings,
                )}
                onPhotoSelection={handlePhotoSelection}
                removePhoto={removePhoto}
                movePhoto={movePhoto}
              />
            ) : null}

            {saveError ? (
              <p className="form-message is-error" role="alert">
                {saveError}
              </p>
            ) : null}
            <div className="rental-form-actions">
              {step > 1 ? (
                <button
                  className="rental-secondary-button"
                  type="button"
                  onClick={goBack}
                  disabled={pending}
                >
                  Back
                </button>
              ) : (
                <Link className="rental-text-action" href="/landlord">
                  Cancel
                </Link>
              )}
              {step < 4 ? (
                <button
                  className="rental-primary-button"
                  type="button"
                  onClick={goForward}
                >
                  Continue
                </button>
              ) : (
                <div className="rental-final-actions">
                  <button
                    className="rental-secondary-button"
                    type="button"
                    onClick={() => void handleSave(false)}
                    disabled={pending}
                  >
                    {pending
                      ? "Saving…"
                      : existingListing
                        ? "Save changes"
                        : "Save draft"}
                  </button>
                  {entitlement?.capabilities.canSubmitListings ? (
                    <button
                      className="rental-primary-button"
                      type="button"
                      onClick={() => void handleSave(true)}
                      disabled={pending}
                    >
                      {pending ? "Saving…" : "Submit for review"}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </form>
        </section>
      </div>
    </RentalFormShell>
  );
}

function RentalBasicsStep({
  values,
  errors,
  availabilityLocked,
  updateField,
}: StepProps & { availabilityLocked: boolean }) {
  return (
    <fieldset className="rental-step-fieldset">
      <legend>
        <span lang="km">ប្រាប់យើងអំពីកន្លែងជួល</span>
        <strong>Start with the rental basics</strong>
      </legend>
      <p className="rental-step-intro">
        Use a name students will recognize, then describe the room offer and
        current capacity.
      </p>
      <div className="rental-field">
        <label htmlFor="propertyName">Property or rental name</label>
        <input
          id="propertyName"
          value={values.propertyName}
          onChange={(event) => updateField("propertyName", event.target.value)}
          maxLength={180}
          autoComplete="organization"
          aria-invalid={Boolean(errors.propertyName)}
          aria-describedby={errorId("propertyName", errors)}
        />
        <FieldError field="propertyName" errors={errors} />
      </div>
      <div className="rental-field-grid">
        <div className="rental-field">
          <label htmlFor="titleKm">Listing title in Khmer</label>
          <input
            id="titleKm"
            lang="km"
            value={values.titleKm}
            onChange={(event) => updateField("titleKm", event.target.value)}
            maxLength={200}
            placeholder="បន្ទប់ជួលនៅជិតសាកលវិទ្យាល័យ"
            aria-invalid={Boolean(errors.titleKm)}
            aria-describedby={errorId("titleKm", errors)}
          />
          <FieldError field="titleKm" errors={errors} />
        </div>
        <div className="rental-field">
          <label htmlFor="titleEn">Listing title in English</label>
          <input
            id="titleEn"
            value={values.titleEn}
            onChange={(event) => updateField("titleEn", event.target.value)}
            maxLength={200}
            placeholder="Student room near RUPP"
          />
        </div>
      </div>
      <div className="rental-field">
        <label htmlFor="propertyType">Rental type</label>
        <select
          id="propertyType"
          value={values.propertyType}
          onChange={(event) =>
            updateField(
              "propertyType",
              event.target.value as RentalFormValues["propertyType"],
            )
          }
        >
          <option value="ROOM">Room</option>
          <option value="DORM_ROOM">Dorm room</option>
          <option value="STUDIO">Studio</option>
          <option value="APARTMENT">Apartment</option>
          <option value="HOUSE">House</option>
          <option value="OTHER_STUDENT_RENTAL">Other student rental</option>
        </select>
      </div>
      <div className="rental-field-grid rental-field-grid-three">
        <NumberField
          id="totalUnits"
          label="Total rooms or units"
          value={values.totalUnits}
          min="1"
          errors={errors}
          onChange={(value) => updateField("totalUnits", value)}
        />
        <NumberField
          id="availableUnits"
          label="Available now"
          value={values.availableUnits}
          min="0"
          disabled={availabilityLocked}
          errors={errors}
          onChange={(value) => updateField("availableUnits", value)}
        />
        <div
          className="availability-readout"
          data-available={Number(values.availableUnits) > 0}
        >
          <span aria-hidden="true">
            {Number(values.availableUnits) > 0 ? "✓" : "×"}
          </span>
          <div>
            <strong>
              {Number(values.availableUnits) > 0 ? "Available" : "Unavailable"}
            </strong>
            <small>This state also appears in the private map preview.</small>
          </div>
        </div>
      </div>
      <div className="rental-field-grid rental-price-grid">
        <div className="rental-field">
          <label htmlFor="monthlyPrice">Monthly rent</label>
          <input
            id="monthlyPrice"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={values.monthlyPrice}
            onChange={(event) =>
              updateField("monthlyPrice", event.target.value)
            }
            aria-invalid={Boolean(errors.monthlyPrice)}
            aria-describedby={errorId("monthlyPrice", errors)}
          />
          <FieldError field="monthlyPrice" errors={errors} />
        </div>
        <div className="rental-field">
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            value={values.currency}
            onChange={(event) =>
              updateField("currency", event.target.value as "USD" | "KHR")
            }
          >
            <option value="USD">USD ($)</option>
            <option value="KHR">KHR (៛)</option>
          </select>
        </div>
        <div className="rental-field">
          <label htmlFor="depositAmount">Deposit amount (optional)</label>
          <input
            id="depositAmount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={values.depositAmount}
            onChange={(event) =>
              updateField("depositAmount", event.target.value)
            }
            aria-invalid={Boolean(errors.depositAmount)}
            aria-describedby={errorId("depositAmount", errors)}
          />
          <FieldError field="depositAmount" errors={errors} />
        </div>
      </div>
    </fieldset>
  );
}

function RentalLocationStep({
  values,
  errors,
  location,
  availableUnits,
  availabilityLocked,
  updateField,
  updateLocation,
}: StepProps & {
  location: { latitude: number; longitude: number } | null;
  availableUnits: number;
  availabilityLocked: boolean;
  updateLocation: (location: {
    latitude: number;
    longitude: number;
    addressLine?: string;
    googlePlaceId?: string;
  }) => void;
}) {
  return (
    <fieldset className="rental-step-fieldset">
      <legend>
        <span lang="km">កំណត់ទីតាំងឱ្យបានត្រឹមត្រូវ</span>
        <strong>Pin the rental location</strong>
      </legend>
      <p className="rental-step-intro">
        Search, click, or drag the pin. If the map is unavailable, enter the
        coordinates manually.
      </p>
      <div className="rental-field">
        <label htmlFor="addressLine">Address students can recognize</label>
        <input
          id="addressLine"
          value={values.addressLine}
          onChange={(event) => updateField("addressLine", event.target.value)}
          maxLength={500}
          autoComplete="street-address"
          placeholder="Street, sangkat, khan, Phnom Penh"
          aria-invalid={Boolean(errors.addressLine)}
          aria-describedby={errorId("addressLine", errors)}
        />
        <FieldError field="addressLine" errors={errors} />
      </div>
      <div className="location-availability-control">
        <NumberField
          id="availableUnits"
          label="Available rooms shown on this preview"
          value={values.availableUnits}
          min="0"
          disabled={availabilityLocked}
          errors={errors}
          onChange={(value) => updateField("availableUnits", value)}
        />
        <p>
          {availabilityLocked
            ? "Return to the dashboard to change room availability."
            : "Change this value to check both available and unavailable marker states before saving."}
        </p>
      </div>
      <RentalLocationPicker
        location={location}
        availableUnits={availableUnits}
        onLocationChange={updateLocation}
      />
      <div className="rental-field-grid">
        <div className="rental-field">
          <label htmlFor="latitude">Latitude</label>
          <input
            id="latitude"
            type="number"
            inputMode="decimal"
            step="0.000001"
            value={values.latitude}
            onChange={(event) => {
              updateField("latitude", event.target.value);
              updateField("googlePlaceId", "");
            }}
            placeholder="11.569000"
            aria-invalid={Boolean(errors.latitude)}
            aria-describedby={errorId("latitude", errors)}
          />
          <FieldError field="latitude" errors={errors} />
        </div>
        <div className="rental-field">
          <label htmlFor="longitude">Longitude</label>
          <input
            id="longitude"
            type="number"
            inputMode="decimal"
            step="0.000001"
            value={values.longitude}
            onChange={(event) => {
              updateField("longitude", event.target.value);
              updateField("googlePlaceId", "");
            }}
            placeholder="104.891400"
            aria-invalid={Boolean(errors.longitude)}
            aria-describedby={errorId("longitude", errors)}
          />
          <FieldError field="longitude" errors={errors} />
        </div>
      </div>
      <div className="rental-field-grid">
        <div className="rental-field">
          <label htmlFor="district">Khan / district (optional)</label>
          <input
            id="district"
            value={values.district}
            onChange={(event) => updateField("district", event.target.value)}
            maxLength={120}
            placeholder="Tuol Kork"
          />
        </div>
        <div className="rental-field">
          <label htmlFor="commune">Sangkat / commune (optional)</label>
          <input
            id="commune"
            value={values.commune}
            onChange={(event) => updateField("commune", event.target.value)}
            maxLength={120}
            placeholder="Tuek L'ak I"
          />
        </div>
      </div>
    </fieldset>
  );
}

function RentalFacilitiesStep({
  values,
  errors,
  amenities,
  updateField,
}: StepProps & { amenities: AmenityDto[] }) {
  return (
    <fieldset className="rental-step-fieldset">
      <legend>
        <span lang="km">បន្ថែមព័ត៌មានដែលសិស្សត្រូវការ</span>
        <strong>Describe facilities and contact</strong>
      </legend>
      <p className="rental-step-intro">
        Clear details reduce unnecessary calls and help students compare real
        monthly costs.
      </p>
      <div className="rental-field-grid">
        <div className="rental-field">
          <label htmlFor="descriptionKm">Description in Khmer</label>
          <textarea
            id="descriptionKm"
            lang="km"
            rows={5}
            maxLength={10_000}
            value={values.descriptionKm}
            onChange={(event) =>
              updateField("descriptionKm", event.target.value)
            }
            aria-invalid={Boolean(errors.descriptionKm)}
            aria-describedby={errorId("descriptionKm", errors)}
          />
          <FieldError field="descriptionKm" errors={errors} />
        </div>
        <div className="rental-field">
          <label htmlFor="descriptionEn">Description in English</label>
          <textarea
            id="descriptionEn"
            rows={5}
            maxLength={10_000}
            value={values.descriptionEn}
            onChange={(event) =>
              updateField("descriptionEn", event.target.value)
            }
          />
        </div>
      </div>

      <fieldset className="amenity-fieldset">
        <legend>Facilities and amenities</legend>
        {amenities.length > 0 ? (
          <div className="amenity-options">
            {amenities.map((amenity) => {
              const checked = values.amenityIds.includes(amenity.id);
              return (
                <label key={amenity.id} data-selected={checked}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      updateField(
                        "amenityIds",
                        checked
                          ? values.amenityIds.filter((id) => id !== amenity.id)
                          : [...values.amenityIds, amenity.id],
                      )
                    }
                  />
                  <span>
                    <strong lang="km">{amenity.nameKm}</strong>
                    <small>{amenity.nameEn}</small>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="rental-inline-note">
            No active amenities are configured. You can still save the rental.
          </p>
        )}
      </fieldset>

      <div className="rental-field-grid rental-field-grid-three">
        <NumberField
          id="bedrooms"
          label="Bedrooms (optional)"
          value={values.bedrooms}
          min="0"
          errors={errors}
          onChange={(value) => updateField("bedrooms", value)}
        />
        <NumberField
          id="bathrooms"
          label="Bathrooms (optional)"
          value={values.bathrooms}
          min="0"
          errors={errors}
          onChange={(value) => updateField("bathrooms", value)}
        />
        <div className="rental-field">
          <label htmlFor="availableFrom">Available from (optional)</label>
          <input
            id="availableFrom"
            type="date"
            value={values.availableFrom}
            onChange={(event) =>
              updateField("availableFrom", event.target.value)
            }
          />
        </div>
      </div>
      <label className="furnished-option">
        <input
          type="checkbox"
          checked={values.furnished}
          onChange={(event) => updateField("furnished", event.target.checked)}
        />
        <span>
          <strong>Furnished</strong>
          <small>Furniture is included with the rental.</small>
        </span>
      </label>

      <div className="rental-field-grid">
        <div className="rental-field">
          <label htmlFor="utilityNotesKm">
            Utility notes in Khmer (optional)
          </label>
          <textarea
            id="utilityNotesKm"
            lang="km"
            rows={3}
            maxLength={10_000}
            value={values.utilityNotesKm}
            onChange={(event) =>
              updateField("utilityNotesKm", event.target.value)
            }
          />
        </div>
        <div className="rental-field">
          <label htmlFor="houseRulesKm">House rules in Khmer (optional)</label>
          <textarea
            id="houseRulesKm"
            lang="km"
            rows={3}
            maxLength={10_000}
            value={values.houseRulesKm}
            onChange={(event) =>
              updateField("houseRulesKm", event.target.value)
            }
          />
        </div>
      </div>

      <fieldset className="contact-fieldset">
        <legend>How should students contact you?</legend>
        <p>
          Contact details come from your landlord profile and are still
          protected by the listing contact policy.
        </p>
        <div className="contact-options">
          {[
            ["IN_APP_ONLY", "In-app inquiry only"],
            ["PHONE", "Phone"],
            ["TELEGRAM", "Telegram"],
            ["PHONE_OR_TELEGRAM", "Phone or Telegram"],
          ].map(([value, label]) => (
            <label
              key={value}
              data-selected={values.contactPreference === value}
            >
              <input
                type="radio"
                name="contactPreference"
                value={value}
                checked={values.contactPreference === value}
                onChange={() =>
                  updateField(
                    "contactPreference",
                    value as RentalFormValues["contactPreference"],
                  )
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </fieldset>
  );
}

function RentalReviewStep({
  values,
  errors,
  amenities,
  photos,
  existingPhotos,
  canManagePhotos,
  onPhotoSelection,
  removePhoto,
  movePhoto,
}: {
  values: RentalFormValues;
  errors: RentalFormErrors;
  amenities: AmenityDto[];
  photos: LocalPhoto[];
  existingPhotos: readonly ListingImageDto[];
  canManagePhotos: boolean;
  onPhotoSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (photoId: string) => void;
  movePhoto: (index: number, direction: -1 | 1) => void;
}) {
  const selectedAmenities = amenities.filter((amenity) =>
    values.amenityIds.includes(amenity.id),
  );
  return (
    <fieldset className="rental-step-fieldset">
      <legend>
        <span lang="km">បន្ថែមរូបថត និងពិនិត្យឡើងវិញ</span>
        <strong>Add photos and review</strong>
      </legend>
      <p className="rental-step-intro">
        {existingPhotos.length > 0
          ? "Existing photos stay with this rental. You can add more photos while your access is active."
          : "Put the clearest exterior or room photo first. Photos are uploaded only after your private draft is created."}
      </p>

      {canManagePhotos ? (
        <div
          className="photo-upload-field"
          data-invalid={Boolean(errors.photos)}
        >
          <label htmlFor="listingPhotos">
            <strong>Choose rental photos</strong>
            <span>
              JPEG, PNG, or WebP. Up to {MAX_LISTING_PHOTOS} photos total, 10 MB
              each.
            </span>
          </label>
          <input
            id="listingPhotos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={onPhotoSelection}
            aria-invalid={Boolean(errors.photos)}
            aria-describedby={errorId("photos", errors)}
          />
          <FieldError field="photos" errors={errors} />
        </div>
      ) : (
        <p className="rental-inline-note">
          Existing photos remain visible. Photo changes require active landlord
          access.
        </p>
      )}

      {existingPhotos.length > 0 ? (
        <ol className="photo-order-list" aria-label="Existing rental photos">
          {existingPhotos.map((photo, index) => (
            <li key={photo.id}>
              <img
                src={photo.publicUrl}
                loading="lazy"
                decoding="async"
                width={photo.width ?? 176}
                height={photo.height ?? 132}
                alt={
                  photo.altTextEn ||
                  photo.altTextKm ||
                  `Existing rental photo ${index + 1}`
                }
              />
              <div>
                <strong>
                  {index === 0
                    ? "Current cover photo"
                    : `Existing photo ${index + 1}`}
                </strong>
                <small>Already uploaded</small>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {photos.length > 0 ? (
        <ol
          className="photo-order-list"
          aria-label="Selected photos in upload order"
        >
          {photos.map((photo, index) => (
            <li key={photo.id}>
              {/* A temporary local object URL is required before the image exists in object storage. */}
              <img
                src={photo.previewUrl}
                alt={`Selected rental preview ${index + 1}`}
              />
              <div>
                <strong>
                  {existingPhotos.length + index === 0
                    ? "Cover photo"
                    : `New photo ${existingPhotos.length + index + 1}`}
                </strong>
                <small>{formatFileSize(photo.file.size)}</small>
              </div>
              <div className="photo-order-actions">
                <button
                  type="button"
                  onClick={() => movePhoto(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${photo.file.name} earlier`}
                >
                  Earlier
                </button>
                <button
                  type="button"
                  onClick={() => movePhoto(index, 1)}
                  disabled={index === photos.length - 1}
                  aria-label={`Move ${photo.file.name} later`}
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label={`Remove ${photo.file.name}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : existingPhotos.length === 0 ? (
        <p className="rental-inline-note">
          A draft can be saved without photos. At least one photo is required
          before submitting for review.
        </p>
      ) : null}

      <section
        className="rental-review-summary"
        aria-labelledby="review-summary-title"
      >
        <h3 id="review-summary-title">Review your student-facing details</h3>
        <dl>
          <div>
            <dt>Rental</dt>
            <dd>
              {values.titleKm.trim() || values.titleEn.trim() || "No title yet"}
            </dd>
          </div>
          <div>
            <dt>Monthly rent</dt>
            <dd>{formatMoney(values.monthlyPrice, values.currency)}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>
              {values.availableUnits || "0"} of {values.totalUnits || "0"} rooms
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{values.addressLine || "No address yet"}</dd>
          </div>
          <div>
            <dt>Amenities</dt>
            <dd>
              {selectedAmenities.length > 0
                ? selectedAmenities.map((amenity) => amenity.nameEn).join(", ")
                : "None selected"}
            </dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{formatContactPreference(values.contactPreference)}</dd>
          </div>
        </dl>
      </section>
    </fieldset>
  );
}

interface StepProps {
  values: RentalFormValues;
  errors: RentalFormErrors;
  updateField: <TKey extends keyof RentalFormValues>(
    field: TKey,
    value: RentalFormValues[TKey],
  ) => void;
}

function NumberField({
  id,
  label,
  value,
  min,
  disabled = false,
  errors,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: string;
  disabled?: boolean;
  errors: RentalFormErrors;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rental-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        step="1"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errorId(id, errors)}
      />
      <FieldError field={id} errors={errors} />
    </div>
  );
}

function FieldError({
  field,
  errors,
}: {
  field: string;
  errors: RentalFormErrors;
}) {
  return errors[field] ? (
    <p className="rental-field-error" id={`${field}-error`} role="alert">
      {errors[field]}
    </p>
  ) : null;
}

function RentalFormShell({ children }: { children: ReactNode }) {
  return (
    <main className="rental-form-page" lang="en">
      <header className="rental-form-header">
        <BrandMark />
        <Link href="/landlord">Landlord workspace</Link>
      </header>
      {children}
    </main>
  );
}

function RentalFormLoading() {
  return (
    <RentalFormShell>
      <div className="rental-form-loading" aria-busy="true" aria-live="polite">
        <aside>
          <div className="skeleton rental-loading-label" />
          <div className="skeleton rental-loading-title" />
          <div className="skeleton rental-loading-line" />
        </aside>
        <section>
          <p>Preparing your rental form…</p>
          <div className="skeleton rental-loading-field" />
          <div className="skeleton rental-loading-field" />
          <div className="skeleton rental-loading-field" />
        </section>
      </div>
    </RentalFormShell>
  );
}

function omitErrors(
  errors: RentalFormErrors,
  fields: ReadonlyArray<string>,
): RentalFormErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => !fields.includes(field)),
  );
}

function errorId(field: string, errors: RentalFormErrors): string | undefined {
  return errors[field] ? `${field}-error` : undefined;
}

function toFormField(apiField: string): string {
  const fieldMap: Record<string, string> = {
    "property.name": "propertyName",
    "property.addressLine": "addressLine",
    "property.totalUnits": "totalUnits",
    "property.latitude": "latitude",
    "property.longitude": "longitude",
    amenityIds: "amenityIds",
  };
  return fieldMap[apiField] ?? apiField;
}

function focusFirstInvalidField(): void {
  window.setTimeout(() => {
    document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
}

function formatPhnomPenhDate(value: string): string {
  return new Intl.DateTimeFormat("en-KH", {
    dateStyle: "medium",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}

function formatListingStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatContactPreference(value: string): string {
  const labels: Record<string, string> = {
    IN_APP_ONLY: "In-app inquiry only",
    PHONE: "Phone",
    TELEGRAM: "Telegram",
    PHONE_OR_TELEGRAM: "Phone or Telegram",
  };
  return labels[value] ?? value;
}

function formatMoney(value: string, currency: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not set";
  return new Intl.NumberFormat("en-KH", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KHR" ? 0 : 2,
  }).format(number);
}

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isEditableStatus(status: ListingStatus): boolean {
  return ["DRAFT", "PAUSED", "RENTED", "REJECTED"].includes(status);
}

import { jobberGraphQL } from "./client";
import type { JobberResult } from "./types";

/**
 * Thin, generic wrappers around VERIFIED Jobber mutations/queries only —
 * verified directly against the connected Jobber Developer Center
 * GraphiQL schema (API version 2025-04-16), not from web research.
 * Nothing here should be extended with a new field/mutation until it's
 * verified the same way.
 *
 * Deliberately NOT included, because it was never verified:
 *   - a standalone `propertyCreate` mutation's argument wrapper name
 *     (is it `input:` or `attributes:`? unconfirmed) — worked around by
 *     attaching the address via `ClientCreateInput.properties` instead,
 *     which WAS confirmed to exist, when creating a brand-new Client
 *   - requestCreateNote (input shape unknown)
 *
 * The read side of a Client's properties — used because
 * `QuoteCreateAttributes.propertyId` is required and this is the only
 * source of a Property ID in this system — is the VERIFIED field
 * `clientProperties` (not `properties`, which is only the write-side
 * input field name on `ClientCreateInput`). Confirmed directly in
 * GraphiQL: `Client.clientProperties -> PropertyConnection.nodes ->
 * Property.id`.
 */

// ---------------------------------------------------------------------------
// clients (search, for reuse-before-create)
// ---------------------------------------------------------------------------

export interface JobberPropertySearchResult {
  id: string;
}

export interface JobberClientSearchResult {
  id: string;
  clientProperties: {
    nodes: JobberPropertySearchResult[];
  };
}

// searchFields' enum values (PRIMARY_EMAIL / PHONES) are written directly
// into the query text rather than passed as a variable, since we were
// given the valid enum values but not the enum type's name to declare a
// typed variable for it.
const CLIENTS_BY_EMAIL_QUERY = `
  query ClientsByEmail($searchTerm: String!) {
    clients(searchTerm: $searchTerm, searchFields: [PRIMARY_EMAIL]) {
      nodes {
        id
        clientProperties {
          nodes {
            id
          }
        }
      }
    }
  }
`;

const CLIENTS_BY_PHONE_QUERY = `
  query ClientsByPhone($searchTerm: String!) {
    clients(searchTerm: $searchTerm, searchFields: [PHONES]) {
      nodes {
        id
        clientProperties {
          nodes {
            id
          }
        }
      }
    }
  }
`;

export async function findJobberClientsByEmail(
  accessToken: string,
  email: string,
): Promise<JobberResult<{ clients: { nodes: JobberClientSearchResult[] } }>> {
  return jobberGraphQL({
    query: CLIENTS_BY_EMAIL_QUERY,
    variables: { searchTerm: email },
    accessToken,
  });
}

export async function findJobberClientsByPhone(
  accessToken: string,
  phone: string,
): Promise<JobberResult<{ clients: { nodes: JobberClientSearchResult[] } }>> {
  return jobberGraphQL({
    query: CLIENTS_BY_PHONE_QUERY,
    variables: { searchTerm: phone },
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// clientCreate
// ---------------------------------------------------------------------------

export interface JobberClientEmailInput {
  address: string;
  primary?: boolean;
  description?: string;
}

export interface JobberClientPhoneInput {
  number: string;
  primary?: boolean;
  smsAllowed?: boolean;
  description?: string;
}

/** Verified AddressAttributes fields only. */
export interface JobberAddressInput {
  street1?: string;
  street2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

/**
 * PropertyAttributes wraps an address — it is not itself flat. Only
 * `address` (required) is populated here; `contacts`, `contactsToAssign`,
 * `customFields`, `taxRateId`, `name` are all left unset (no data/no
 * business decision for any of them yet — e.g. taxRateId is explicitly
 * deferred pending the Iowa sales tax decision).
 */
export interface JobberPropertyInput {
  address: JobberAddressInput;
}

/** Only the ClientCreateInput fields we have a verified, unambiguous shape for. */
export interface JobberClientCreateInput {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  isCompany: boolean;
  emails?: JobberClientEmailInput[];
  phones?: JobberClientPhoneInput[];
  properties?: JobberPropertyInput[];
}

export interface JobberCreatedClient {
  id: string;
  clientProperties: {
    nodes: JobberPropertySearchResult[];
  };
}

const CLIENT_CREATE_MUTATION = `
  mutation ClientCreate($input: ClientCreateInput!) {
    clientCreate(input: $input) {
      client {
        id
        clientProperties {
          nodes {
            id
          }
        }
      }
      userErrors {
        message
        path
      }
    }
  }
`;

export async function createJobberClient(
  accessToken: string,
  input: JobberClientCreateInput,
): Promise<JobberResult<{ clientCreate: { client: JobberCreatedClient } }>> {
  return jobberGraphQL({
    query: CLIENT_CREATE_MUTATION,
    variables: { input },
    accessToken,
    userErrorsPath: ["clientCreate"],
  });
}

// ---------------------------------------------------------------------------
// requestCreate
// ---------------------------------------------------------------------------

export interface JobberFormItemInput {
  label: string;
  answerText?: string;
}

export interface JobberFormSectionInput {
  label: string;
  items: JobberFormItemInput[];
}

export interface JobberFormInput {
  sections: JobberFormSectionInput[];
}

export interface JobberRequestDetailsInput {
  form: JobberFormInput;
}

/** Only the RequestCreateLineItemAttributes fields this project currently populates. */
export interface JobberRequestLineItemInput {
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  saveToProductsAndServices: boolean;
  sortOrder?: number;
}

export interface JobberRequestCreateInput {
  clientId: string;
  propertyId?: string;
  title?: string;
  lineItems?: JobberRequestLineItemInput[];
  requestDetails?: JobberRequestDetailsInput;
}

export interface JobberCreatedRequest {
  id: string;
}

const REQUEST_CREATE_MUTATION = `
  mutation RequestCreate($input: RequestCreateInput!) {
    requestCreate(input: $input) {
      request {
        id
      }
      userErrors {
        message
        path
      }
    }
  }
`;

export async function createJobberRequest(
  accessToken: string,
  input: JobberRequestCreateInput,
): Promise<JobberResult<{ requestCreate: { request: JobberCreatedRequest } }>> {
  return jobberGraphQL({
    query: REQUEST_CREATE_MUTATION,
    variables: { input },
    accessToken,
    userErrorsPath: ["requestCreate"],
  });
}

// ---------------------------------------------------------------------------
// quoteCreate
// ---------------------------------------------------------------------------

/** Only the QuoteCreateLineItemAttributes fields this project currently populates. */
export interface JobberQuoteLineItemInput {
  name: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  saveToProductsAndServices: boolean;
}

/** QuoteTransitionOnCreate has exactly this one verified value. */
export type JobberQuoteTransition = "AWAITING_RESPONSE";

/** Only the QuoteCreateAttributes fields this project currently populates. */
export interface JobberQuoteCreateAttributes {
  clientId: string;
  propertyId: string;
  requestId?: string;
  title?: string;
  message?: string;
  lineItems: JobberQuoteLineItemInput[];
  transitionQuoteTo?: JobberQuoteTransition;
}

export interface JobberCreatedQuote {
  id: string;
  clientHubUri?: string;
  jobberWebUri: string;
  quoteStatus: string;
}

// Note the argument name here is `attributes`, not `input` — verified
// explicitly, and different from clientCreate/requestCreate's `input:`.
const QUOTE_CREATE_MUTATION = `
  mutation QuoteCreate($attributes: QuoteCreateAttributes!) {
    quoteCreate(attributes: $attributes) {
      quote {
        id
        clientHubUri
        jobberWebUri
        quoteStatus
      }
      userErrors {
        message
        path
      }
    }
  }
`;

export async function createJobberQuote(
  accessToken: string,
  attributes: JobberQuoteCreateAttributes,
): Promise<JobberResult<{ quoteCreate: { quote: JobberCreatedQuote } }>> {
  return jobberGraphQL({
    query: QUOTE_CREATE_MUTATION,
    variables: { attributes },
    accessToken,
    userErrorsPath: ["quoteCreate"],
  });
}

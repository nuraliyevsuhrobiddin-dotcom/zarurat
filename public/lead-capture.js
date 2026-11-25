// Static service pages have no app code; keep the ad source when a visitor lands here first.
import {captureLeadSource} from './lead-source.js?v=1';
captureLeadSource();

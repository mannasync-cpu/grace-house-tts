export * from './wix';
export * from './planningCenter';
export * from './mailchimp';
export * from './sns';
export * from './whatsapp';

import { WixService } from './wix';
import { PlanningCenterService } from './planningCenter';
import { MailchimpService } from './mailchimp';
import { SnsService } from './sns';
import { WhatsAppService } from './whatsapp';
import { db } from '../firebase'; // Import DB to ensure services can use it if needed

export const wixService = new WixService();
export const planningCenterService = new PlanningCenterService();
export const mailchimpService = new MailchimpService();
export const snsService = new SnsService();
export const whatsappService = new WhatsAppService();

export const services = {
    wix: wixService,
    pco: planningCenterService,
    mailchimp: mailchimpService,
    sns: snsService,
    whatsapp: whatsappService,
};

#include "hmodel.h"
#include <iostream>
#include <random>
#include <time.h>

hierarchical_model::~hierarchical_model()
{
	if (p) {
		delete p;
	}

	if (ptrndata) {
		delete ptrndata;
	}

	if (pnewdata) {
		delete pnewdata;
	}

	if (z) {
		for (int m = 0; m < M; m++) {
			if (z[m]) {
				delete z[m];
			}
		}
	}

	if (nw) {
		for (int w = 0; w < V; w++) {
			if (nw[w]) {
				delete nw[w];
			}
		}
	}

	if (nd) {
		for (int m = 0; m < M; m++) {
			if (nd[m]) {
				delete nd[m];
			}
		}
	}


	if (theta) {
		for (int m = 0; m < M; m++) {
			if (theta[m]) {
				delete theta[m];
			}
		}
	}

	if (phi) {
		for (int k = 0; k < _Ks[L - 1]; k++) {
			if (phi[k]) {
				delete phi[k];
			}
		}
	}

	if (heta) {
		for (int l = 0; l < L - 1; l++) {
			for (int k = 0; k < _Ks[l]; k++) {
				delete heta[l][k];
			}
			delete heta[l];
		}
	}
}

int hierarchical_model::init_est_hierarchical()
{
	int m, n, w, k;
	int Kn = _Ks[L - 1];
	int K1 = _Ks[0];
	p = new double[Kn];

	// + read training data
	ptrndata = new dataset;
	if (ptrndata->read_trndata(dir + dfile, dir + wordmapfile)) {
		std::cout << dir << dfile << ", " << dir << wordmapfile << endl;
		printf("Fail to read training data!\n");
		return 1;
	}

	// + allocate memory and assign values for variables
	M = ptrndata->M;
	V = ptrndata->V;
	// K: from command line or default value
	// alpha, beta: from command line or default values
	// niters, savestep: from command line or default values


	nw = new int*[V];
	for (w = 0; w < V; w++) {
		nw[w] = new int[K];
		for (k = 0; k < K; k++) {
			nw[w][k] = 0;
		}
	}

	nd = new int*[M];
	for (m = 0; m < M; m++) {
		nd[m] = new int[K];
		for (k = 0; k < K; k++) {
			nd[m][k] = 0;
		}
	}

	nwsum = new int[K];
	for (k = 0; k < K; k++) {
		nwsum[k] = 0;
	}

	ndsum = new int[M];
	for (m = 0; m < M; m++) {
		ndsum[m] = 0;
	}

	srandom(time(0)); // initialize for random number generation
	z = new int*[M];
	for (m = 0; m < ptrndata->M; m++) {
		int N = ptrndata->docs[m]->length;
		z[m] = new int[N];

		// initialize for z
		for (n = 0; n < N; n++) {
			double r = (double)random() / (double)RAND_MAX;
			int topic = (int)((r * (double)(Kn - 1)));
			z[m][n] = topic;
			nw[ptrndata->docs[m]->words[n]][topic] += 1;
			// number of words in document i assigned to topic j
			nd[m][topic] += 1;
			// total number of words assigned to topic j
			nwsum[topic] += 1;
		}
		// total number of words in document i
		ndsum[m] = N;
	}

	theta = new double*[M];
	for (m = 0; m < M; m++) {
		theta[m] = new double[K1];
	}

	phi = new double*[Kn];
	for (k = 0; k < Kn; k++) {
		phi[k] = new double[V];
	}

	//heta value, the probability matrix between topic levels
	//create space then 
	//give random number
	//then normalise
	for (int l = 0; l < L-1; l++) {
		heta[l] = new double*[_Ks[l]];
		for (int k = 0; k < _Ks[l]; k++) {
			heta[l][k] = new double[_Ks[l + 1]];
			int sum = 0;
			for (int k2 = 0; k2 < _Ks[l + 1]; k2++) {
				double r = (double)random() / (double)RAND_MAX;
				heta[l][k][k2] = r;
				sum += r;
			}
			for (int k2 = 0; k2 < _Ks[l + 1]; k2++) {
				heta[l][k][k2] /= sum;
			}

		}
	}

	return 0;
}

void hierarchical_model::set_default_values()
{
	wordmapfile = "wordmap.txt";
	trainlogfile = "trainlog.txt";
	tassign_suffix = ".tassign";
	theta_suffix = ".theta";
	phi_suffix = ".phi";
	others_suffix = ".others";
	twords_suffix = ".twords";

	dir = "./";
	dfile = "trndocs.dat";
	model_name = "model-final";
	model_status = MODEL_STATUS_UNKNOWN;

	ptrndata = NULL;
	pnewdata = NULL;

	M = 0;
	V = 0;
	K = 100;
	_Ks = NULL;
	alpha = 50.0 / K;
	beta = 0.1;
	eta = 0.1;

	niters = 2000;
	liter = 0;
	savestep = 2000;
	twords = 0;
	withrawstrs = 0;

	p = NULL;
	z = NULL;
	nw = NULL;
	nd = NULL;
	nwsum = NULL;
	ndsum = NULL;
	theta = NULL;
	phi = NULL;

	heta = NULL;

	newM = 0;
	newV = 0;
	newz = NULL;
	newnw = NULL;
	newnd = NULL;
	newnwsum = NULL;
	newndsum = NULL;
	newtheta = NULL;
	newphi = NULL;
}

void hierarchical_model::estimate()
{
	if (twords > 0) {
		// print out top words per topic
		dataset::read_wordmap(dir + wordmapfile, &id2word);
	}
	printf("Sampling %d iterations!\n", niters);

	int last_iter = liter;
	for (liter = last_iter + 1; liter <= niters + last_iter; liter++) {
		printf("Iteration %d ...\n", liter);

		// for all z_i
		for (int m = 0; m < M; m++) {
			for (int n = 0; n < ptrndata->docs[m]->length; n++) {
				// (z_i = z[m][n])
				// sample from p(z_i|z_-i, w)
				int topic = sampling(m, n);
				z[m][n] = topic;
			}
		}

		
	}

	printf("Gibbs sampling completed!\n");
	printf("Saving the final model!\n");
	compute_theta();
	compute_phi();
}

void hierarchical_model::remove_word(int m, int n) {
	int topic = z[m][n];
	int w = ptrndata->docs[m]->words[n];
	nw[w][topic] -= 1;
	nd[m][topic] -= 1;
	nwsum[topic] -= 1;
	ndsum[m] -= 1;
}

void hierarchical_model::resample_word(int m, int n, int topic)
{
	int w = ptrndata->docs[m]->words[n];
	nw[w][topic] += 1;
	nd[m][topic] += 1;
	nwsum[topic] += 1;
	ndsum[m] += 1;
}

int hierarchical_model::sample(int m, int n)
{
	int Kn = _Ks[L - 1];
	int K1 = _Ks[0];
	// remove z_i from the count variables

	remove_word(m,n);
	int topic = z[m][n];
	int w = ptrndata->docs[m]->words[n];
	double Vbeta = V * beta;
	double Kalpha = K * alpha;
	// do multinomial sampling via cumulative method
	double s;
	for (int k = 0; k < Kn; k++) {
		s = (nw[w][k] + beta) / (nwsum[k] + Vbeta) *
			(nd[m][k] + alpha) / (ndsum[m] + Kalpha);
		p[k] = s;
	}
	// cumulate multinomial parameters
	for (int k = 1; k < Kn; k++) {
		p[k] += p[k - 1];
	}
	// scaled sample because of unnormalized p[] 
	double u = ((double)random() / (double)RAND_MAX) * p[K - 1];

	for (topic = 0; topic < K; topic++) {
		if (p[topic] >= u) {
			break;
		}
	}
	resample_word(m, n, topic);
	// add newly estimated z_i to count variables


	return topic;
}
